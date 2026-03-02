import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes, createHash } from "crypto";
import { HTLC_ABI, USDC_ABI, LockState } from "@payproof/contracts";
import {
  DirectTransferFacilitator,
  MemoryPreimageStore,
  MemoryLedgerStore,
} from "@payproof/server";
import type { PaymentPayload, PaymentRequirements } from "@payproof/contracts";
import {
  getAgentAccount,
  getMerchantAccount,
  getArcPublicClient,
  getAgentArcWalletClient,
  getMerchantArcWalletClient,
  HTLC_ADDRESS,
  USDC_ARC_ADDRESS,
  readArcLock,
  waitForArcTx,
  sleep,
} from "../helpers.js";

function generatePreimage(): { preimage: string; hashlock: string; preimageHex: `0x${string}`; hashlockHex: `0x${string}` } {
  const bytes = randomBytes(32);
  const preimage = bytes.toString("hex");
  const hash = createHash("sha256").update(bytes).digest();
  const hashlock = "0x" + hash.toString("hex");
  return {
    preimage,
    hashlock,
    preimageHex: `0x${preimage}` as `0x${string}`,
    hashlockHex: hashlock as `0x${string}`,
  };
}

function randomLockId(): `0x${string}` {
  return `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
}

describe("DirectTransferFacilitator (Arc)", () => {
  let preimageStore: MemoryPreimageStore;
  let ledgerStore: MemoryLedgerStore;
  let facilitator: DirectTransferFacilitator;
  // Use the address derived from MERCHANT_PRIVATE_KEY since postDataHash requires msg.sender == recipient
  const merchantRecipient = getMerchantAccount().address;

  beforeAll(async () => {
    preimageStore = new MemoryPreimageStore();
    ledgerStore = new MemoryLedgerStore();
    facilitator = new DirectTransferFacilitator({
      htlcContractAddress: HTLC_ADDRESS(),
      merchantEvmPrivateKey: process.env.MERCHANT_PRIVATE_KEY!,
      merchantSolanaPrivateKey: process.env.MERCHANT_SOLANA_PRIVATE_KEY,
      htlcSolanaProgramId: process.env.HTLC_SOLANA_PROGRAM_ID,
      preimageStore,
      ledgerStore,
    });

    // Ensure agent has USDC approval
    const publicClient = getArcPublicClient();
    const agentAccount = getAgentAccount();
    const allowance = await publicClient.readContract({
      address: USDC_ARC_ADDRESS,
      abi: USDC_ABI,
      functionName: "allowance",
      args: [agentAccount.address, HTLC_ADDRESS()],
    }) as bigint;

    if (allowance < BigInt(10_000_000)) {
      const agentClient = getAgentArcWalletClient();
      const txHash = await agentClient.writeContract({
        address: USDC_ARC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [HTLC_ADDRESS(), BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
      });
      await waitForArcTx(txHash);
    }
  }, 60_000);

  async function lockOnArc(lockId: `0x${string}`, hashlockHex: `0x${string}`, amount: bigint) {
    const timelock = BigInt(Math.floor(Date.now() / 1000) + 300);
    const agentClient = getAgentArcWalletClient();
    const txHash = await agentClient.writeContract({
      address: HTLC_ADDRESS(),
      abi: HTLC_ABI,
      functionName: "lock",
      args: [lockId, merchantRecipient, USDC_ARC_ADDRESS, amount, hashlockHex, timelock],
    });
    await waitForArcTx(txHash);
    return { timelock };
  }

  function makePayload(lockId: string, hashlock: string, amount: string): { paymentPayload: PaymentPayload; paymentRequirements: PaymentRequirements } {
    const paymentRequirements: PaymentRequirements = {
      scheme: "direct",
      network: "eip155:5042002",
      asset: USDC_ARC_ADDRESS,
      amount,
      payTo: merchantRecipient,
      maxTimeoutSeconds: 300,
      extra: { hashlock },
    };

    const paymentPayload: PaymentPayload = {
      x402Version: 2,
      resource: { url: "https://example.com/api/data", description: "", mimeType: "" },
      accepted: paymentRequirements,
      payload: { lockId },
    };

    return { paymentPayload, paymentRequirements };
  }

  it("verify() positive: valid lock returns isValid=true", async () => {
    const lockId = randomLockId();
    const { hashlock, hashlockHex } = generatePreimage();

    await lockOnArc(lockId, hashlockHex, 1000n);

    const { paymentPayload, paymentRequirements } = makePayload(lockId, hashlock, "1000");
    const result = await facilitator.verify(paymentPayload, paymentRequirements);

    expect(result.isValid).toBe(true);
    expect(result.payer?.toLowerCase()).toBe(getAgentAccount().address.toLowerCase());
  }, 60_000);

  it("verify() wrong amount: insufficient → isValid=false", async () => {
    const lockId = randomLockId();
    const { hashlock, hashlockHex } = generatePreimage();

    await lockOnArc(lockId, hashlockHex, 1000n);

    const { paymentPayload, paymentRequirements } = makePayload(lockId, hashlock, "9999999");
    const result = await facilitator.verify(paymentPayload, paymentRequirements);

    expect(result.isValid).toBe(false);
    expect(result.invalidReason).toBe("insufficient_amount");
  }, 60_000);

  it("verify() wrong recipient: mismatched address → isValid=false", async () => {
    const lockId = randomLockId();
    const { hashlock, hashlockHex } = generatePreimage();

    await lockOnArc(lockId, hashlockHex, 1000n);

    const { paymentPayload, paymentRequirements } = makePayload(lockId, hashlock, "1000");
    // Override payTo to a different address
    paymentRequirements.payTo = "0x0000000000000000000000000000000000000001";

    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    expect(result.isValid).toBe(false);
    expect(result.invalidReason).toBe("wrong_recipient");
  }, 60_000);

  it("postDataHash(): posts hash on-chain, state → DataPosted", async () => {
    const lockId = randomLockId();
    const { hashlock, hashlockHex } = generatePreimage();

    await lockOnArc(lockId, hashlockHex, 1000n);

    const dataHash = `0x${randomBytes(32).toString("hex")}`;
    const txHash = await facilitator.postDataHash(lockId, dataHash, "eip155:5042002");

    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);

    const lock = await readArcLock(lockId);
    expect(lock.state).toBe(LockState.DataPosted);
  }, 90_000);

  it("claimAfterConfirmation(): watches for confirm, claims, records ledger", async () => {
    const lockId = randomLockId();
    const { preimage, hashlock, hashlockHex } = generatePreimage();

    // Store preimage in the facilitator's preimage store
    // We need to manually add it since we're not going through the normal middleware flow
    const preimageStoreHack = preimageStore as any;
    preimageStoreHack.secrets = preimageStoreHack.secrets || new Map();
    preimageStoreHack.secrets.set(hashlock, { preimage, createdAt: Date.now() });

    await lockOnArc(lockId, hashlockHex, 1000n);

    // Post data hash
    const dataHash = `0x${randomBytes(32).toString("hex")}`;
    await facilitator.postDataHash(lockId, dataHash, "eip155:5042002");

    // Start claim watcher in background
    const claimPromise = facilitator.claimAfterConfirmation(lockId, hashlock, "eip155:5042002", "/api/test");

    // Wait a bit, then agent confirms receipt
    await sleep(3000);
    const agentClient = getAgentArcWalletClient();
    const confirmTx = await agentClient.writeContract({
      address: HTLC_ADDRESS(),
      abi: HTLC_ABI,
      functionName: "confirmReceipt",
      args: [lockId, dataHash as `0x${string}`],
    });
    await waitForArcTx(confirmTx);

    // Wait for claim to complete
    await claimPromise;

    const lock = await readArcLock(lockId);
    expect(lock.state).toBe(LockState.Claimed);

    // Verify ledger entry recorded
    const ledger = ledgerStore.getAll();
    const entry = ledger.find((tx) => tx.id === lockId);
    expect(entry).toBeDefined();
    expect(entry?.type).toBe("htlc-claim");
    expect(entry?.network).toBe("eip155:5042002");
  }, 180_000);
});
