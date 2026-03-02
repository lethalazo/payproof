import { type ChainConfig, CHAIN_REGISTRY } from "@payproof/contracts";
import type { PendingLock } from "@payproof/contracts";
import { createEvmWallet, type EvmWallet } from "./evm/wallet.js";
import { createArcWallet, type ArcWallet } from "./evm/arc.js";
import { createHtlcClient, type HtlcClientConfig } from "./evm/htlc-client.js";
import { createSolanaWallet, type SolanaWallet, type SolanaWalletConfig } from "./solana/solana.js";
import { createHtlcSolanaClient, type HtlcSolanaClientConfig } from "./solana/htlc-solana-client.js";
import { MemoryLockStore, type LockStore } from "./stores/lock-store.js";
import { createX402ClientWrapper, type X402ClientWrapper } from "./x402/x402.js";
import { startAutoRefundSweeper, type AutoRefundHandle } from "./auto-refund.js";

/** Per-family chain configuration for the new `chains` config. */
export interface ChainsConfig {
  evm?: {
    privateKey: string;
    htlcContractAddress?: `0x${string}`;
    /** Restrict to specific EVM networks (e.g. ["eip155:5042002"]). Defaults to all EVM chains in registry. */
    networks?: string[];
  };
  solana?: {
    privateKey: string;
    htlcProgramId?: string;
    usdcMint?: string;
    rpcUrl?: string;
  };
}

/** Auto-refund sweeper configuration. */
export interface AutoRefundConfig {
  enabled: boolean;
  /** Sweep interval in ms. Default: 30000 (30s). */
  intervalMs?: number;
  /** Callback fired on each successful refund. */
  onRefund?: (lockId: string, network: string, txHash: string) => void;
}

export interface PayproofClientConfig {
  /** EVM private key (hex, with or without 0x). Required unless chains.evm is provided. */
  evmPrivateKey?: string;
  /** HTLC contract address on Arc. Required unless chains.evm is provided. */
  htlcContractAddress?: `0x${string}`;
  /** Solana private key (base58). Optional — omit to disable Solana. */
  solanaPrivateKey?: string;
  /** Solana HTLC program ID. Optional. */
  htlcSolanaProgramId?: string;
  /** Solana USDC mint address. Optional. */
  solanaUsdcMint?: string;
  /** Solana RPC URL. Optional, defaults to devnet. */
  solanaRpcUrl?: string;
  /** LockStore — defaults to MemoryLockStore. */
  lockStore?: LockStore;
  /** Modular chain configuration. If provided, takes precedence over top-level fields. */
  chains?: ChainsConfig;
  /** Auto-refund sweeper configuration. Disabled by default. */
  autoRefund?: AutoRefundConfig;
}

export interface PayproofClient {
  /** Get the x402-enhanced fetch function for making paid API calls. */
  getFetchWithPayment(): typeof fetch;
  /** Set the preferred network for the next payment. */
  setPreferredNetwork(network: string | null): void;
  /** EVM wallet (Base Sepolia). */
  evmWallet: EvmWallet;
  /** Arc wallet. */
  arcWallet: ArcWallet;
  /** Solana wallet (null if not configured). */
  solanaWallet: SolanaWallet | null;
  /** Lock store for tracking HTLC payments. */
  lockStore: LockStore;
  /** Arc HTLC client operations. */
  htlcClient: ReturnType<typeof createHtlcClient>;
  /** Solana HTLC client operations (null if not configured). */
  htlcSolanaClient: ReturnType<typeof createHtlcSolanaClient> | null;
  /** Returns the list of enabled ChainConfig entries based on the client's configuration. */
  getEnabledChains(): ChainConfig[];
  /** Stop the auto-refund sweeper (no-op if not enabled). */
  stopAutoRefund(): void;
}

/**
 * Resolve the modular `chains` config into flat fields, with backwards
 * compatibility for the legacy top-level keys.
 */
function resolveConfig(config: PayproofClientConfig) {
  const evmPrivateKey = config.chains?.evm?.privateKey ?? config.evmPrivateKey ?? "";
  const htlcContractAddress = (config.chains?.evm?.htlcContractAddress ??
    config.htlcContractAddress ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`;

  const evmNetworks = config.chains?.evm?.networks ?? null; // null = all EVM

  const solanaPrivateKey = config.chains?.solana?.privateKey ?? config.solanaPrivateKey;
  const htlcSolanaProgramId = config.chains?.solana?.htlcProgramId ?? config.htlcSolanaProgramId;
  const solanaUsdcMint = config.chains?.solana?.usdcMint ?? config.solanaUsdcMint;
  const solanaRpcUrl = config.chains?.solana?.rpcUrl ?? config.solanaRpcUrl;

  const evmEnabled = !!evmPrivateKey;
  const solanaEnabled = !!solanaPrivateKey;

  return {
    evmPrivateKey,
    htlcContractAddress,
    evmNetworks,
    solanaPrivateKey,
    htlcSolanaProgramId,
    solanaUsdcMint,
    solanaRpcUrl,
    evmEnabled,
    solanaEnabled,
  };
}

/**
 * Create a fully configured Payproof client for making x402 payments
 * across Base Sepolia, Arc Testnet, and Solana Devnet.
 */
export function createPayproofClient(config: PayproofClientConfig): PayproofClient {
  const lockStore = config.lockStore ?? new MemoryLockStore();
  const resolved = resolveConfig(config);

  // EVM wallets
  const evmWallet = createEvmWallet({ privateKey: resolved.evmPrivateKey });
  const arcWallet = createArcWallet({ privateKey: resolved.evmPrivateKey });

  // Arc HTLC client
  const htlcClient = createHtlcClient({
    htlcContractAddress: resolved.htlcContractAddress,
    arcPublicClient: arcWallet.arcPublicClient,
    arcWalletClient: arcWallet.arcWalletClient,
  });

  // Solana wallet + HTLC client (optional)
  let solanaWallet: SolanaWallet | null = null;
  let htlcSolanaClient: ReturnType<typeof createHtlcSolanaClient> | null = null;

  if (resolved.solanaEnabled && resolved.solanaPrivateKey) {
    solanaWallet = createSolanaWallet({
      privateKey: resolved.solanaPrivateKey,
      usdcMint: resolved.solanaUsdcMint,
      rpcUrl: resolved.solanaRpcUrl,
    });

    if (resolved.htlcSolanaProgramId) {
      htlcSolanaClient = createHtlcSolanaClient({
        programId: resolved.htlcSolanaProgramId,
        keypair: solanaWallet.keypair,
        connection: solanaWallet.connection,
        usdcMint: solanaWallet.usdcMint,
      });
    }
  }

  // x402 client wrapper — now receives HTLC clients for post-response decryption
  const x402Wrapper = createX402ClientWrapper({
    account: evmWallet.account,
    basePublicClient: evmWallet.basePublicClient,
    directClientConfig: {
      htlcClient,
      htlcSolanaClient: htlcSolanaClient ?? undefined,
    },
    lockStore,
    htlcClient,
    htlcSolanaClient: htlcSolanaClient ?? undefined,
  });

  /** Build the list of enabled chains based on config. */
  function getEnabledChains(): ChainConfig[] {
    const chains: ChainConfig[] = [];

    if (resolved.evmEnabled) {
      for (const [id, chain] of Object.entries(CHAIN_REGISTRY)) {
        if (chain.family !== "evm") continue;
        // If specific EVM networks requested, filter
        if (resolved.evmNetworks && !resolved.evmNetworks.includes(id)) continue;
        chains.push(chain);
      }
    }

    if (resolved.solanaEnabled) {
      for (const chain of Object.values(CHAIN_REGISTRY)) {
        if (chain.family === "solana") chains.push(chain);
      }
    }

    return chains;
  }

  // Auto-refund sweeper
  let autoRefundHandle: AutoRefundHandle | null = null;
  if (config.autoRefund?.enabled) {
    autoRefundHandle = startAutoRefundSweeper({
      lockStore,
      htlcClient,
      htlcSolanaClient: htlcSolanaClient ?? undefined,
      arcPublicClient: arcWallet.arcPublicClient,
      htlcContractAddress: resolved.htlcContractAddress,
      solanaWallet: solanaWallet ?? undefined,
      htlcSolanaProgramId: resolved.htlcSolanaProgramId,
      intervalMs: config.autoRefund.intervalMs ?? 30_000,
      onRefund: config.autoRefund.onRefund,
    });
  }

  return {
    getFetchWithPayment: () => x402Wrapper.getFetchWithPayment(),
    setPreferredNetwork: (network) => x402Wrapper.setPreferredNetwork(network),
    evmWallet,
    arcWallet,
    solanaWallet,
    lockStore,
    htlcClient,
    htlcSolanaClient,
    getEnabledChains,
    stopAutoRefund: () => {
      if (autoRefundHandle) {
        autoRefundHandle.stop();
        autoRefundHandle = null;
      }
    },
  };
}
