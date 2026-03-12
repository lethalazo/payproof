import { CHAIN_REGISTRY, type ChainConfig } from "@payproof/contracts";

/**
 * Build the list of enabled chains from environment variables.
 * EVM chains are enabled if AGENT_PRIVATE_KEY exists.
 * Solana support exists in the SDK but is disabled in the demo app.
 */
export function getEnabledChains(): ChainConfig[] {
  const chains: ChainConfig[] = [];

  if (process.env.AGENT_PRIVATE_KEY) {
    for (const chain of Object.values(CHAIN_REGISTRY)) {
      if (chain.family === "evm") chains.push(chain);
    }
  }

  return chains;
}

/** Get enabled chains that use the "direct" (HTLC) scheme — these support refunds. */
export function getDirectChains(): ChainConfig[] {
  return getEnabledChains().filter((c) => c.scheme === "direct");
}

/** Build a network info array for marketplace API entries. */
export function getNetworkInfoForAPIs(): { label: string; scheme: string; network: string; color: string }[] {
  return getEnabledChains().map((c) => ({
    label: c.label,
    scheme: c.scheme,
    network: c.id,
    color: c.color ?? "gray",
  }));
}
