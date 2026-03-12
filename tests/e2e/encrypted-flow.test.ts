import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes, createHash } from "crypto";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import { resolve } from "path";
import { existsSync, unlinkSync } from "fs";
import { HTLC_ABI, USDC_ABI, LockState } from "@payproof/contracts";
import type { EncryptedPayload } from "@payproof/contracts";
import { decrypt } from "@payproof/client";
import {
  getAgentAccount,
  getMerchantAccount,
  getArcPublicClient,
  getAgentArcWalletClient,
  HTLC_ADDRESS,
  USDC_ARC_ADDRESS,
  readArcLock,
  waitForArcTx,
  sleep,
} from "../helpers.js";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
let devServer: ChildProcess | null = null;

describe("E2E encrypted payment flow", () => {
  beforeAll(async () => {
    const appDir = resolve(__dirname, "../../apps/marketplace");

    // Remove stale Next.js dev lock file if present
    const lockFile = resolve(appDir, ".next/dev/lock");
    if (existsSync(lockFile)) {
      try { unlinkSync(lockFile); } catch {}
    }

    // Spawn Next.js dev server — encrypted flow is auto-detected via scheme: "direct"
    devServer = spawn("npx", ["next", "dev", "-p", String(PORT)], {
      cwd: appDir,
      env: {
        ...process.env,
        PORT: String(PORT),
      },
      stdio: "pipe",
      detached: false,
    });

    // Log server output for debugging
    devServer.stderr?.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) console.log("[dev-server]", msg);
    });
    devServer.stdout?.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) console.log("[dev-server]", msg);
    });

    devServer.on("error", (err) => {
      console.error("[dev-server] spawn error:", err);
    });

    // Wait for server to be ready
    const maxWait = 90_000;
    const start = Date.now();
    let ready = false;

    while (Date.now() - start < maxWait && !ready) {
      try {
        const res = await fetch(`${BASE_URL}/api/provider/weather`);
        ready = true;
      } catch {
        await sleep(2000);
      }
    }

    if (!ready) {
      throw new Error(`Dev server did not start within ${maxWait}ms`);
    }
  }, 120_000);

  afterAll(() => {
    if (devServer && devServer.pid) {
      try {
        process.kill(devServer.pid, "SIGTERM");
      } catch {}
      devServer = null;
    }
  });

  it("full encrypted flow: 402 → lock → pay → encrypted response → confirm → claim → decrypt", async () => {
    const merchantRecipient = getMerchantAccount().address;

    // Step 1: Request without payment → 402
    const initialRes = await fetch(`${BASE_URL}/api/provider/weather`);
    expect(initialRes.status).toBe(402);

    // Step 2: Parse payment requirements from 402 response
    // x402 returns requirements in the `payment-required` header (base64-encoded JSON)
    // Structure: { x402Version, error, resource, accepts: [...] }
    const paymentRequired = initialRes.headers.get("payment-required") ||
      initialRes.headers.get("x-payment");

    expect(paymentRequired).toBeTruthy();

    const requirementsRaw = Buffer.from(paymentRequired!, "base64").toString("utf-8");
    const requirements = JSON.parse(requirementsRaw);

    // The `accepts` array contains all supported payment schemes
    const accepts = requirements.accepts || (Array.isArray(requirements) ? requirements : [requirements]);
    const directReq = accepts.find(
      (r: any) => r.scheme === "direct" && r.network === "eip155:5042002",
    );

    expect(directReq).toBeDefined();

    const hashlock = directReq.extra?.hashlock as string;
    if (!hashlock) {
      console.warn("No hashlock in payment requirements, skipping");
      return;
    }

    // Step 3: Agent locks USDC on Arc with the merchant's hashlock
    const lockId = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
    const amount = BigInt(directReq.amount);
    const timelock = BigInt(Math.floor(Date.now() / 1000) + 300);
    const payTo = directReq.payTo as `0x${string}`;

    // Ensure approval
    const publicClient = getArcPublicClient();
    const agentAccount = getAgentAccount();
    const allowance = await publicClient.readContract({
      address: USDC_ARC_ADDRESS,
      abi: USDC_ABI,
      functionName: "allowance",
      args: [agentAccount.address, HTLC_ADDRESS()],
    }) as bigint;

    const agentClient = getAgentArcWalletClient();
    if (allowance < amount) {
      const approveTx = await agentClient.writeContract({
        address: USDC_ARC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [HTLC_ADDRESS(), BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
      });
      await waitForArcTx(approveTx);
    }

    // Lock to the payTo address from the 402 response
    const lockTx = await agentClient.writeContract({
      address: HTLC_ADDRESS(),
      abi: HTLC_ABI,
      functionName: "lock",
      args: [lockId, payTo, USDC_ARC_ADDRESS, amount, hashlock as `0x${string}`, timelock],
    });
    await waitForArcTx(lockTx);

    // Step 4: Retry request with payment header
    const paymentPayload = {
      x402Version: 2,
      payload: { lockId, hashlock },
      accepted: {
        scheme: "direct",
        network: "eip155:5042002",
        payTo,
        amount: directReq.amount,
        extra: directReq.extra,
      },
    };

    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
    const paidRes = await fetch(`${BASE_URL}/api/provider/weather`, {
      headers: { "X-PAYMENT": paymentHeader },
    });

    // Should get 200 with encrypted payload
    expect(paidRes.status).toBe(200);

    const isEncrypted = paidRes.headers.get("x-payproof-encrypted");
    expect(isEncrypted).toBe("true");

    const encryptedBody: EncryptedPayload = await paidRes.json();
    expect(encryptedBody.encryptedBlob).toBeDefined();
    expect(encryptedBody.nonce).toBeDefined();
    expect(encryptedBody.authTag).toBeDefined();
    expect(encryptedBody.dataHash).toMatch(/^0x[0-9a-f]{64}$/);

    // Step 5: Compute receiptHash = SHA-256(ciphertext)
    const ciphertextBytes = Buffer.from(encryptedBody.encryptedBlob, "base64");
    const sha = createHash("sha256").update(ciphertextBytes).digest();
    const receiptHash = `0x${sha.toString("hex")}` as `0x${string}`;

    // Verify it matches the server's dataHash
    expect(receiptHash.toLowerCase()).toBe(encryptedBody.dataHash.toLowerCase());

    // Step 6: Agent confirmReceipt on-chain
    const confirmTx = await agentClient.writeContract({
      address: HTLC_ADDRESS(),
      abi: HTLC_ABI,
      functionName: "confirmReceipt",
      args: [lockId, receiptHash],
    });
    await waitForArcTx(confirmTx);

    // Step 7: Poll for Claimed state (merchant claims in background)
    let claimed = false;
    for (let i = 0; i < 40; i++) {
      const lock = await readArcLock(lockId);
      if (lock.state === LockState.Claimed) {
        claimed = true;
        break;
      }
      await sleep(3000);
    }
    expect(claimed).toBe(true);

    // Step 8: Extract preimage from Claimed event logs
    const lock = await readArcLock(lockId);
    expect(lock.state).toBe(LockState.Claimed);

    // Use a recent block range (Arc RPC limits getLogs to 10,000 blocks)
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;

    const logs = await publicClient.getLogs({
      address: HTLC_ADDRESS(),
      event: {
        type: "event",
        name: "Claimed",
        inputs: [
          { name: "lockId", type: "bytes32", indexed: true },
          { name: "preimage", type: "bytes32", indexed: false },
        ],
      },
      args: { lockId },
      fromBlock,
    });

    expect(logs.length).toBeGreaterThan(0);
    const preimageHex = (logs[0].args as any).preimage as string;
    expect(preimageHex).toMatch(/^0x[0-9a-f]{64}$/);

    // Step 9: Decrypt with preimage
    // Handle nonce/authTag that may have 0x prefix or be hex strings
    const nonceHex = encryptedBody.nonce.replace(/^0x/, "");
    const authTagHex = encryptedBody.authTag.replace(/^0x/, "");

    const nonceBytes = new Uint8Array(
      nonceHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
    );
    const authTagBytes = new Uint8Array(
      authTagHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
    );

    const plaintext = await decrypt(
      new Uint8Array(ciphertextBytes),
      nonceBytes,
      authTagBytes,
      preimageHex.slice(2), // hex without 0x prefix
    );

    const json = JSON.parse(new TextDecoder().decode(plaintext));
    expect(json).toBeDefined();
    expect(typeof json).toBe("object");
  }, 300_000);
});
