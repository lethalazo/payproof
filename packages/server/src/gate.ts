import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { CHAIN_REGISTRY, type ChainConfig } from "@payproof/contracts";
import type { Network } from "@payproof/contracts";

import { DirectTransferFacilitator, type DirectTransferFacilitatorConfig } from "./facilitator.js";
import { DirectTransferServer, type DirectTransferServerConfig } from "./x402-direct-server.js";
import { MemoryPreimageStore } from "./stores/preimage-store.js";
import { MemoryLedgerStore } from "./stores/ledger-store.js";
import type { PreimageStore } from "./stores/preimage-store.js";
import type { LedgerStore } from "./stores/ledger-store.js";

/** Per-family server chain configuration. */
export interface ServerChainsConfig {
  evm?: {
    merchantAddress: string;
    merchantPrivateKey: string;
    htlcContractAddress?: `0x${string}`;
    /** Restrict to specific EVM networks. Defaults to all EVM chains in registry. */
    networks?: string[];
  };
  solana?: {
    merchantAddress: string;
    merchantPrivateKey: string;
    htlcProgramId?: string;
    usdcMint?: string;
    rpcUrl?: string;
  };
}

export interface PayproofServerConfig {
  /** Merchant EVM address that receives payments. */
  merchantEvmAddress?: string;
  /** Merchant EVM private key (hex) for signing HTLC claims. */
  merchantEvmPrivateKey?: string;
  /** Merchant Solana address. Optional if Solana not used. */
  merchantSolAddress?: string;
  /** Merchant Solana private key (base58). Optional. */
  merchantSolanaPrivateKey?: string;
  /** HTLC contract address on Arc EVM. */
  htlcContractAddress?: `0x${string}`;
  /** Solana HTLC program ID. */
  htlcSolanaProgramId?: string;
  /** Solana USDC mint address. */
  solanaUsdcMint?: string;
  /** Solana RPC URL. */
  solanaRpcUrl?: string;
  /** Hosted facilitator URL for exact scheme. Defaults to x402.org. */
  hostedFacilitatorUrl?: string;
  /** Treasury address for unresolvable disputes. */
  treasuryAddress?: string;
  /** PreimageStore - defaults to MemoryPreimageStore. */
  preimageStore?: PreimageStore;
  /** LedgerStore - defaults to MemoryLedgerStore. */
  ledgerStore?: LedgerStore;
  /** Modular chain configuration. If provided, takes precedence over top-level fields. */
  chains?: ServerChainsConfig;
}

export interface RouteConfig {
  accepts: {
    scheme: string;
    network: Network;
    payTo: string;
    price: string;
    maxTimeoutSeconds: number;
  }[];
  description: string;
}

export interface PayproofServer {
  /** The underlying x402 resource server. */
  resourceServer: InstanceType<typeof x402ResourceServer>;
  /** The direct transfer facilitator instance. */
  facilitator: DirectTransferFacilitator;
  /** The direct transfer server-side scheme handler. */
  directServer: DirectTransferServer;
  /** The preimage store. */
  preimageStore: PreimageStore;
  /** The ledger store. */
  ledgerStore: LedgerStore;
  /** Build multi-chain payment accepts for a given price. */
  multiChainAccepts(price: string): RouteConfig["accepts"];
}

/**
 * Resolve server config - maps new `chains` config to flat fields for backwards compat.
 */
function resolveServerConfig(config: PayproofServerConfig) {
  const merchantEvmAddress = config.chains?.evm?.merchantAddress ?? config.merchantEvmAddress ?? "";
  const merchantEvmPrivateKey = config.chains?.evm?.merchantPrivateKey ?? config.merchantEvmPrivateKey ?? "";
  const htlcContractAddress = (config.chains?.evm?.htlcContractAddress ??
    config.htlcContractAddress ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const evmNetworks = config.chains?.evm?.networks ?? null;
  const evmEnabled = !!merchantEvmAddress;

  const merchantSolAddress = config.chains?.solana?.merchantAddress ?? config.merchantSolAddress;
  const merchantSolanaPrivateKey = config.chains?.solana?.merchantPrivateKey ?? config.merchantSolanaPrivateKey;
  const htlcSolanaProgramId = config.chains?.solana?.htlcProgramId ?? config.htlcSolanaProgramId;
  const solanaUsdcMint = config.chains?.solana?.usdcMint ?? config.solanaUsdcMint;
  const solanaRpcUrl = config.chains?.solana?.rpcUrl ?? config.solanaRpcUrl;
  const solanaEnabled = !!merchantSolanaPrivateKey;

  return {
    merchantEvmAddress,
    merchantEvmPrivateKey,
    htlcContractAddress,
    evmNetworks,
    evmEnabled,
    merchantSolAddress: merchantSolAddress || merchantEvmAddress,
    merchantSolanaPrivateKey,
    htlcSolanaProgramId,
    solanaUsdcMint,
    solanaRpcUrl,
    solanaEnabled,
  };
}

/**
 * Build the list of enabled chains from server config.
 */
function getEnabledServerChains(resolved: ReturnType<typeof resolveServerConfig>): ChainConfig[] {
  const chains: ChainConfig[] = [];

  if (resolved.evmEnabled) {
    for (const [id, chain] of Object.entries(CHAIN_REGISTRY)) {
      if (chain.family !== "evm") continue;
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

/**
 * Create a fully configured Payproof server with HTLC facilitator,
 * x402 resource server, and all scheme registrations.
 */
export function createPayproofServer(config: PayproofServerConfig): PayproofServer {
  const preimageStore = config.preimageStore ?? new MemoryPreimageStore();
  const ledgerStore = config.ledgerStore ?? new MemoryLedgerStore();
  const resolved = resolveServerConfig(config);
  const enabledChains = getEnabledServerChains(resolved);

  const facilitatorConfig: DirectTransferFacilitatorConfig = {
    htlcContractAddress: resolved.htlcContractAddress,
    merchantEvmPrivateKey: resolved.merchantEvmPrivateKey,
    merchantSolanaPrivateKey: resolved.merchantSolanaPrivateKey,
    htlcSolanaProgramId: resolved.htlcSolanaProgramId,
    solanaUsdcMint: resolved.solanaUsdcMint,
    solanaRpcUrl: resolved.solanaRpcUrl,
    preimageStore,
    ledgerStore,
  };

  const facilitator = new DirectTransferFacilitator(facilitatorConfig);

  const hostedFacilitator = new HTTPFacilitatorClient({
    url: config.hostedFacilitatorUrl || "https://x402.org/facilitator",
  });

  const server = new x402ResourceServer([hostedFacilitator, facilitator]);

  const directServerConfig: DirectTransferServerConfig = {
    htlcContractAddress: resolved.htlcContractAddress,
    htlcSolanaProgramId: resolved.htlcSolanaProgramId,
    preimageStore,
  };

  const directServer = new DirectTransferServer(directServerConfig);

  // Register schemes only for enabled chains
  for (const chain of enabledChains) {
    if (chain.scheme === "exact") {
      server.register(chain.id as Network, new ExactEvmScheme());
    } else if (chain.scheme === "direct") {
      server.register(chain.id as Network, directServer);
    }
  }

  function multiChainAccepts(price: string): RouteConfig["accepts"] {
    return enabledChains.map((chain) => ({
      scheme: chain.scheme,
      network: chain.id as Network,
      payTo: chain.family === "solana" ? resolved.merchantSolAddress : resolved.merchantEvmAddress,
      price,
      maxTimeoutSeconds: 60,
    }));
  }

  return {
    resourceServer: server,
    facilitator,
    directServer,
    preimageStore,
    ledgerStore,
    multiChainAccepts,
  };
}
