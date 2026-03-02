import { HTLC_ABI, LockState } from "@payproof/contracts";
import type { PublicClient } from "viem";
import type { LockStore } from "./stores/lock-store.js";
import type { createHtlcClient } from "./evm/htlc-client.js";
import type { createHtlcSolanaClient } from "./solana/htlc-solana-client.js";
import type { SolanaWallet } from "./solana/solana.js";
import { deriveLockPDA } from "./solana/htlc-solana-client.js";
import { PublicKey } from "@solana/web3.js";

export interface AutoRefundSweeperConfig {
  lockStore: LockStore;
  htlcClient: ReturnType<typeof createHtlcClient>;
  htlcSolanaClient?: ReturnType<typeof createHtlcSolanaClient>;
  arcPublicClient: PublicClient;
  htlcContractAddress: `0x${string}`;
  solanaWallet?: SolanaWallet;
  htlcSolanaProgramId?: string;
  intervalMs: number;
  onRefund?: (lockId: string, network: string, txHash: string) => void;
}

export interface AutoRefundHandle {
  stop: () => void;
}

/**
 * Start a background sweeper that periodically checks pending locks
 * and auto-refunds any that have expired timelocks.
 */
export function startAutoRefundSweeper(config: AutoRefundSweeperConfig): AutoRefundHandle {
  const {
    lockStore,
    htlcClient,
    htlcSolanaClient,
    arcPublicClient,
    htlcContractAddress,
    solanaWallet,
    htlcSolanaProgramId,
    intervalMs,
    onRefund,
  } = config;

  const interval = setInterval(async () => {
    try {
      const locks = await lockStore.getAll();
      const now = Math.floor(Date.now() / 1000);

      for (const lock of locks) {
        if (lock.status !== "locked") continue;
        if (lock.timelock > now) continue; // not expired yet

        try {
          if (lock.network === "eip155:5042002") {
            // Check on-chain state first
            const lockData = await arcPublicClient.readContract({
              address: htlcContractAddress,
              abi: HTLC_ABI,
              functionName: "getLock",
              args: [lock.lockId as `0x${string}`],
            });
            const data = lockData as unknown as { state: number };

            if (data.state === LockState.Claimed) {
              await lockStore.updateStatus(lock.lockId, "claimed_by_server");
              continue;
            }
            if (data.state === LockState.Refunded) {
              await lockStore.updateStatus(lock.lockId, "refunded");
              continue;
            }
            if (data.state !== LockState.Locked) continue;

            const txHash = await htlcClient.refundLock(lock.lockId as `0x${string}`);
            await lockStore.updateStatus(lock.lockId, "refunded");
            onRefund?.(lock.lockId, lock.network, txHash);
          } else if (lock.network === "solana:devnet" && htlcSolanaClient && solanaWallet && htlcSolanaProgramId) {
            const programId = new PublicKey(htlcSolanaProgramId);
            const lockIdBuf = Buffer.from(lock.lockId, "hex");
            const [lockPDA] = deriveLockPDA(lockIdBuf, programId);

            const accountInfo = await solanaWallet.connection.getAccountInfo(lockPDA);
            if (!accountInfo || accountInfo.data.length < 186) continue;

            const state = accountInfo.data[152];

            if (state === LockState.Claimed) {
              await lockStore.updateStatus(lock.lockId, "claimed_by_server");
              continue;
            }
            if (state === LockState.Refunded) {
              await lockStore.updateStatus(lock.lockId, "refunded");
              continue;
            }
            if (state !== LockState.Locked) continue;

            const signature = await htlcSolanaClient.refundLockSolana(lockIdBuf);
            await lockStore.updateStatus(lock.lockId, "refunded");
            onRefund?.(lock.lockId, lock.network, signature);
          }
        } catch {
          // Log but don't crash — retry next interval
        }
      }
    } catch {
      // Top-level catch — sweeper must never crash
    }
  }, intervalMs);

  return {
    stop: () => clearInterval(interval),
  };
}
