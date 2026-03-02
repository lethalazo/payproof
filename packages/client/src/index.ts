export {
  createPayproofClient,
  type PayproofClientConfig,
  type PayproofClient,
  type ChainsConfig,
  type AutoRefundConfig,
} from "./client.js";

export {
  type LockStore,
  MemoryLockStore,
} from "./stores/lock-store.js";

export {
  createEvmWallet,
  type EvmWalletConfig,
  type EvmWallet,
} from "./evm/wallet.js";

export {
  createArcWallet,
  type ArcWalletConfig,
  type ArcWallet,
} from "./evm/arc.js";

export {
  createHtlcClient,
  generateLockId,
  type HtlcClientConfig,
} from "./evm/htlc-client.js";

export {
  createSolanaWallet,
  type SolanaWalletConfig,
  type SolanaWallet,
} from "./solana/solana.js";

export {
  createHtlcSolanaClient,
  deriveLockPDA,
  deriveEscrowPDA,
  generateSolanaLockId,
  type HtlcSolanaClientConfig,
} from "./solana/htlc-solana-client.js";

export {
  DirectTransferClient,
  type DirectTransferClientConfig,
} from "./x402/x402-direct-client.js";

export {
  decrypt,
  computeSHA256,
} from "./crypto/encryption.js";

export {
  startAutoRefundSweeper,
  type AutoRefundHandle,
} from "./auto-refund.js";
