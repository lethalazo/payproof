import { paymentProxy } from "@x402/next";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { PayproofServer, RouteConfig } from "../gate.js";
import { runWithRequestContext } from "../context/request-context.js";
import { encrypt, computeSHA256 } from "../crypto/encryption.js";
import type { EncryptedPayload } from "@payproof/contracts";

/**
 * Create a Next.js middleware handler from a PayproofServer and route config.
 *
 * Direct scheme (HTLC) payments always use the encrypted flow because the
 * 7-state HTLC requires postDataHash → confirmReceipt → claim. The encrypted
 * flow handles this lifecycle automatically.
 *
 * Exact scheme payments use the x402 base handler (passthrough).
 */
export function createNextMiddleware(
  server: PayproofServer,
  routes: Record<string, RouteConfig>,
) {
  // The base x402 proxy handles 402 responses, payment verification, and settlement
  const baseHandler = paymentProxy(routes, server.resourceServer);

  // Generate a per-instance secret for internal bypass authentication
  const internalSecret = crypto.randomUUID();

  return async (req: NextRequest) => {
    // Internal data-fetch bypass: the encrypted flow fetches the route's data
    // via an internal HTTP call. Verify with shared secret to prevent external spoofing.
    if (req.headers.get("x-payproof-internal") === internalSecret) {
      return NextResponse.next();
    }

    return runWithRequestContext({ signal: req.signal }, async () => {
      const paymentHeader = req.headers.get("x-payment") || req.headers.get("payment-signature");

      // If there's a payment header, check if it's a direct scheme payment.
      // Direct scheme requires the full encrypted flow for HTLC settlement.
      if (paymentHeader) {
        let isDirectScheme = false;
        let paymentPayload: {
          payload: Record<string, unknown>;
          accepted: {
            network: string;
            extra?: Record<string, unknown>;
            payTo: string;
            amount: string;
            scheme: string;
          };
        } | null = null;

        try {
          const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
          paymentPayload = JSON.parse(decoded);
          isDirectScheme = paymentPayload?.accepted?.scheme === "direct";
        } catch {
          // Not parseable — fall through to base handler
        }

        if (isDirectScheme && paymentPayload) {
          // --- Direct scheme: full encrypted flow ---
          // The 7-state HTLC requires: postDataHash → confirmReceipt → claim.
          // We must run the encrypted flow to complete this lifecycle.
          return handleDirectSchemePayment(req, paymentPayload, server, internalSecret);
        }
      }

      // For non-direct schemes (exact) and unpaid requests, use x402 base handler.
      // Unpaid requests get a 402; exact scheme payments get verified and passed through.
      return baseHandler(req);
    });
  };
}

/**
 * Handle a direct scheme (HTLC) payment with the full encrypted flow:
 *   1. Verify lock on-chain
 *   2. Fetch route data internally
 *   3. Encrypt with preimage
 *   4. Post dataHash on-chain
 *   5. Return EncryptedPayload
 *   6. Fire-and-forget claimAfterConfirmation
 */
async function handleDirectSchemePayment(
  req: NextRequest,
  paymentPayload: {
    payload: Record<string, unknown>;
    accepted: {
      network: string;
      extra?: Record<string, unknown>;
      payTo: string;
      amount: string;
      scheme: string;
    };
  },
  server: PayproofServer,
  internalSecret: string,
): Promise<NextResponse> {
  const { payload } = paymentPayload;
  const accepted = paymentPayload.accepted;

  const lockId = payload.lockId as string;
  const hashlock = (payload.hashlock || accepted.extra?.hashlock) as string;
  const network = accepted.network;

  if (!lockId || !hashlock) {
    return NextResponse.json(
      { error: "missing_payment_fields", message: "lockId and hashlock are required for direct scheme" },
      { status: 400 },
    );
  }

  // Step 1: Verify the lock on-chain
  const paymentRequirements = {
    scheme: accepted.scheme,
    network: accepted.network as `${string}:${string}`,
    asset: "",
    amount: accepted.amount,
    payTo: accepted.payTo,
    maxTimeoutSeconds: 300,
    extra: accepted.extra || {},
  };

  const verifyResult = await server.facilitator.verify(
    {
      x402Version: 2,
      resource: { url: req.url, description: "", mimeType: "" },
      accepted: paymentRequirements,
      payload,
    },
    paymentRequirements,
  );

  if (!verifyResult.isValid) {
    return NextResponse.json(
      { error: "payment_invalid", reason: verifyResult.invalidReason, message: verifyResult.invalidMessage },
      { status: 402 },
    );
  }

  // Step 2: Fetch route data via internal HTTP call (bypass middleware)
  const internalUrl = new URL(req.url);
  const dataResponse = await fetch(internalUrl.toString(), {
    headers: { "x-payproof-internal": internalSecret },
  });

  if (!dataResponse.ok) {
    return NextResponse.json(
      { error: "internal_error", message: `Route returned ${dataResponse.status}` },
      { status: 500 },
    );
  }

  const plaintextBytes = new Uint8Array(await dataResponse.arrayBuffer());

  // Step 3: Get preimage
  const preimage = await server.preimageStore.getPreimage(hashlock);
  if (!preimage) {
    return NextResponse.json(
      { error: "internal_error", message: "Preimage not found for hashlock" },
      { status: 500 },
    );
  }

  // Step 4: Encrypt plaintext with preimage as AES-256-GCM key
  const { ciphertext, nonce, authTag } = await encrypt(plaintextBytes, preimage);

  // Step 5: Compute dataHash = SHA-256(ciphertext)
  const dataHash = await computeSHA256(ciphertext);

  // Step 6: Post dataHash on-chain
  try {
    await server.facilitator.postDataHash(lockId, dataHash, network);
  } catch (err) {
    // The tx may have landed on-chain even though confirmation timed out.
    // Check on-chain state before giving up.
    const onChainState = await server.facilitator.getLockState(lockId, network);
    if (onChainState !== undefined && onChainState >= 2) {
      // DataPosted (2) or later — tx DID land, proceed with encrypted response
      console.warn("[middleware] postDataHash confirmation failed but on-chain state is", onChainState, "— proceeding");
    } else {
      console.error("[middleware] postDataHash failed:", err);
      return NextResponse.json(
        { error: "post_data_hash_failed", message: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  // Step 7: Build EncryptedPayload response
  const encryptedPayload: EncryptedPayload = {
    encryptedBlob: Buffer.from(ciphertext).toString("base64"),
    nonce: Array.from(nonce).map((b) => b.toString(16).padStart(2, "0")).join(""),
    authTag: Array.from(authTag).map((b) => b.toString(16).padStart(2, "0")).join(""),
    dataHash,
  };

  const response = NextResponse.json(encryptedPayload, { status: 200 });
  response.headers.set("x-payproof-encrypted", "true");
  response.headers.set("content-type", "application/json");

  // Step 8: Fire-and-forget claim
  server.facilitator.claimAfterConfirmation(lockId, hashlock, network, req.nextUrl.pathname, preimage).catch((err) => {
    console.error("[middleware] claimAfterConfirmation error:", err);
  });

  return response;
}
