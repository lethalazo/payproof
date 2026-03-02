import { randomBytes } from "crypto";
import { maxUint256, type Hash, type PublicClient, type WalletClient } from "viem";
import { HTLC_ABI, LockState, USDC_ABI, USDC_ASSETS, arcTestnet } from "@payproof/contracts";

const USDC_ARC = USDC_ASSETS["eip155:5042002"].address as `0x${string}`;

export interface HtlcClientConfig {
  htlcContractAddress: `0x${string}`;
  arcPublicClient: PublicClient;
  arcWalletClient: WalletClient;
}

/** Generate a random 32-byte lock ID as hex. */
export function generateLockId(): `0x${string}` {
  return `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
}

export function createHtlcClient(config: HtlcClientConfig) {
  const { htlcContractAddress, arcPublicClient, arcWalletClient } = config;

  async function approveUSDCForHTLC(requiredAmount?: bigint): Promise<Hash | null> {
    const account = arcWalletClient.account;
    if (!account) throw new Error("Wallet client has no account");

    const currentAllowance = await arcPublicClient.readContract({
      address: USDC_ARC,
      abi: USDC_ABI,
      functionName: "allowance",
      args: [account.address, htlcContractAddress],
    });

    const needed = requiredAmount ?? maxUint256;
    if (currentAllowance >= needed) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (arcWalletClient as any).writeContract({
      chain: arcTestnet,
      account,
      address: USDC_ARC,
      abi: USDC_ABI,
      functionName: "approve",
      args: [htlcContractAddress, maxUint256],
    });

    await arcPublicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function lockFunds(params: {
    lockId: `0x${string}`;
    recipient: `0x${string}`;
    token: `0x${string}`;
    amount: bigint;
    hashlock: `0x${string}`;
    timelockSeconds: number;
  }): Promise<Hash> {
    const timelock = BigInt(Math.floor(Date.now() / 1000) + params.timelockSeconds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (arcWalletClient as any).writeContract({
      chain: arcTestnet,
      account: arcWalletClient.account,
      address: htlcContractAddress,
      abi: HTLC_ABI,
      functionName: "lock",
      args: [
        params.lockId,
        params.recipient,
        params.token,
        params.amount,
        params.hashlock,
        timelock,
      ],
    });

    await arcPublicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function refundLock(lockId: `0x${string}`): Promise<Hash> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (arcWalletClient as any).writeContract({
      chain: arcTestnet,
      account: arcWalletClient.account,
      address: htlcContractAddress,
      abi: HTLC_ABI,
      functionName: "refund",
      args: [lockId],
    });

    await arcPublicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  /**
   * Confirm receipt of encrypted data on-chain.
   * The receiptHash must match the dataHash posted by the merchant.
   */
  async function confirmReceipt(params: {
    lockId: `0x${string}`;
    receiptHash: `0x${string}`;
  }): Promise<Hash> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (arcWalletClient as any).writeContract({
      chain: arcTestnet,
      account: arcWalletClient.account,
      address: htlcContractAddress,
      abi: HTLC_ABI,
      functionName: "confirmReceipt",
      args: [params.lockId, params.receiptHash],
    });

    await arcPublicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  /**
   * Watch for the merchant's claim transaction and extract the preimage.
   * Polls the lock state and reads Claimed event logs once state changes.
   * Returns the preimage hex string (without 0x prefix).
   */
  async function watchForClaim(params: {
    lockId: `0x${string}`;
    timeoutMs?: number;
  }): Promise<string> {
    const timeoutMs = params.timeoutMs ?? 60_000;
    const pollIntervalMs = 2_000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const lock = await arcPublicClient.readContract({
        address: htlcContractAddress,
        abi: HTLC_ABI,
        functionName: "getLock",
        args: [params.lockId],
      });

      const lockData = lock as unknown as { state: number };

      if (lockData.state === LockState.Claimed) {
        // Read the Claimed event to get the preimage
        const logs = await arcPublicClient.getLogs({
          address: htlcContractAddress,
          event: {
            type: "event",
            name: "Claimed",
            inputs: [
              { name: "lockId", type: "bytes32", indexed: true },
              { name: "preimage", type: "bytes32", indexed: false },
            ],
          },
          args: { lockId: params.lockId },
          fromBlock: await arcPublicClient.getBlockNumber().then(n => n > 5000n ? n - 5000n : 0n),
        });

        if (logs.length > 0) {
          const preimage = logs[0].args.preimage as string;
          // Remove 0x prefix
          return preimage.startsWith("0x") ? preimage.slice(2) : preimage;
        }

        throw new Error("Lock is Claimed but could not find Claimed event log");
      }

      if (lockData.state !== LockState.Confirmed && lockData.state !== LockState.DataPosted) {
        throw new Error(`Unexpected lock state ${lockData.state} while waiting for claim`);
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new Error(`Timed out waiting for claim after ${timeoutMs}ms`);
  }

  return {
    approveUSDCForHTLC,
    lockFunds,
    refundLock,
    confirmReceipt,
    watchForClaim,
  };
}
