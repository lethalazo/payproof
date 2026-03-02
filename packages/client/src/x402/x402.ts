import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { PublicClient } from "viem";
import type { PendingLock, EncryptedPayload } from "@payproof/contracts";
import type { LockStore } from "../stores/lock-store.js";
import { DirectTransferClient, type DirectTransferClientConfig } from "./x402-direct-client.js";
import { decrypt, computeSHA256 } from "../crypto/encryption.js";
import type { createHtlcClient } from "../evm/htlc-client.js";
import type { createHtlcSolanaClient } from "../solana/htlc-solana-client.js";

type LocalAccount = Parameters<typeof toClientEvmSigner>[0];

export interface X402ClientConfig {
  account: LocalAccount;
  basePublicClient: PublicClient;
  directClientConfig: DirectTransferClientConfig;
  lockStore: LockStore;
  /** EVM HTLC client for post-response on-chain interactions. */
  htlcClient: ReturnType<typeof createHtlcClient>;
  /** Solana HTLC client for post-response on-chain interactions. */
  htlcSolanaClient?: ReturnType<typeof createHtlcSolanaClient>;
}

export interface X402ClientWrapper {
  getFetchWithPayment(): typeof fetch;
  setPreferredNetwork(network: string | null): void;
}

export function createX402ClientWrapper(config: X402ClientConfig): X402ClientWrapper {
  let _preferredNetwork: string | null = null;
  let _lastLockId: string | null = null;
  let _lastNetwork: string | null = null;
  let _lastHashlock: string | null = null;
  let _wrappedFetch: typeof fetch | null = null;

  function setPreferredNetwork(network: string | null) {
    _preferredNetwork = network;
  }

  function getFetchWithPayment(): typeof fetch {
    if (!_wrappedFetch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signer = toClientEvmSigner(config.account, config.basePublicClient as any);

      const client = new x402Client((_version, accepts) => {
        if (_preferredNetwork) {
          const preferred = accepts.find((r) => r.network === _preferredNetwork);
          if (preferred) return preferred;
        }
        const direct = accepts.find((r) => r.scheme === "direct");
        return direct || accepts[0];
      });

      registerExactEvmScheme(client, { signer });

      const directClient = new DirectTransferClient(config.directClientConfig);
      client.register("eip155:5042002", directClient);
      client.register("solana:devnet", directClient);

      client.onAfterPaymentCreation(async (ctx) => {
        const { payload } = ctx.paymentPayload;
        const { accepted } = ctx.paymentPayload;

        if (accepted.scheme !== "direct") return;

        const lockId = payload.lockId as string;
        if (!lockId) return;

        const timelockSeconds = (accepted.extra?.timelockSeconds as number) || 300;
        const now = Math.floor(Date.now() / 1000);

        const lock: PendingLock = {
          lockId,
          network: accepted.network,
          amount: accepted.amount,
          timelock: now + timelockSeconds,
          createdAt: Date.now(),
          status: "locked",
          lockPDA: payload.lockPDA as string | undefined,
          escrowPDA: payload.escrowPDA as string | undefined,
        };

        await config.lockStore.add(lock);
        _lastLockId = lockId;
        _lastNetwork = accepted.network;
        _lastHashlock = (payload.hashlock || accepted.extra?.hashlock) as string;
      });

      const rawFetch = wrapFetchWithPayment(fetch, client);
      _wrappedFetch = async (input, init?) => {
        _lastLockId = null;
        _lastNetwork = null;
        _lastHashlock = null;
        const response = await rawFetch(input, init);

        // Check for encrypted response from the new atomic protocol
        if (response.ok && response.headers.get("x-payproof-encrypted") === "true" && _lastLockId) {
          return handleEncryptedResponse(response, _lastLockId, _lastNetwork!, _lastHashlock!);
        }

        if (response.ok && _lastLockId) {
          await config.lockStore.updateStatus(_lastLockId, "settled");
        }
        return response;
      };
    }
    return _wrappedFetch;
  }

  /**
   * Post-response decryption pipeline for the atomic data-for-payment protocol.
   *
   * 1. Parse EncryptedPayload from response body
   * 2. Decode encryptedBlob from base64 → ciphertext bytes
   * 3. receiptHash = SHA-256(ciphertext_bytes)
   * 4. Post confirmReceipt on-chain
   * 5. Watch for Claimed event → extract preimage
   * 6. Decrypt: plaintext = AES-256-GCM.decrypt(ciphertext, nonce, authTag, preimage)
   * 7. Return new Response with plaintext
   */
  async function handleEncryptedResponse(
    response: Response,
    lockId: string,
    network: string,
    _hashlock: string,
  ): Promise<Response> {
    // Step 1: Parse EncryptedPayload
    const payload: EncryptedPayload = await response.json();

    // Persist encrypted payload for retry safety
    const pendingLock = await config.lockStore.get(lockId);
    if (pendingLock) {
      pendingLock.encryptedPayload = payload;
      await config.lockStore.add(pendingLock);
    }

    // Step 2: Decode encryptedBlob from base64
    const ciphertextBytes = Uint8Array.from(atob(payload.encryptedBlob), (c) => c.charCodeAt(0));

    // Step 3: Compute receiptHash = SHA-256(ciphertext)
    const receiptHash = await computeSHA256(ciphertextBytes);

    // Step 4: Post confirmReceipt on-chain
    if (network === "eip155:5042002") {
      await config.htlcClient.confirmReceipt({
        lockId: lockId as `0x${string}`,
        receiptHash: receiptHash as `0x${string}`,
      });
    } else if (network === "solana:devnet" && config.htlcSolanaClient) {
      const lockIdBuf = Buffer.from(lockId.replace(/^0x/, ""), "hex");
      const receiptHashBuf = Buffer.from(receiptHash.replace(/^0x/, ""), "hex");
      await config.htlcSolanaClient.confirmReceiptSolana({
        lockId: lockIdBuf,
        receiptHash: receiptHashBuf,
      });
    } else {
      throw new Error(`Cannot confirm receipt: unsupported network ${network}`);
    }

    // Step 5: Watch for Claimed event → extract preimage
    let preimageHex: string;
    if (network === "eip155:5042002") {
      preimageHex = await config.htlcClient.watchForClaim({
        lockId: lockId as `0x${string}`,
        timeoutMs: 240_000,
      });
    } else if (network === "solana:devnet" && config.htlcSolanaClient) {
      const lockIdBuf = Buffer.from(lockId.replace(/^0x/, ""), "hex");
      preimageHex = await config.htlcSolanaClient.watchForClaimSolana({
        lockId: lockIdBuf,
        timeoutMs: 180_000,
      });
    } else {
      throw new Error(`Cannot watch for claim: unsupported network ${network}`);
    }

    // Step 6: Decrypt
    const nonceBytes = hexToBytes(payload.nonce);
    const authTagBytes = hexToBytes(payload.authTag);
    const plaintext = await decrypt(ciphertextBytes, nonceBytes, authTagBytes, preimageHex);

    // Update lock status
    await config.lockStore.updateStatus(lockId, "settled");

    // Step 7: Return new Response with plaintext
    const newHeaders = new Headers(response.headers);
    newHeaders.delete("x-payproof-encrypted");
    // Try to preserve content-type from original — default to application/json
    if (!newHeaders.has("x-original-content-type")) {
      newHeaders.set("content-type", "application/json");
    }

    return new Response(plaintext, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  return {
    getFetchWithPayment,
    setPreferredNetwork,
  };
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
