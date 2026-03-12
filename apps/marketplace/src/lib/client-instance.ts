import { createPayproofClient, type PayproofClient } from "@payproof/client";

let _client: PayproofClient | null = null;

function requireEnv(name: string, hint: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} is required — ${hint}`);
  return val;
}

/** Lazily-initialized singleton PayproofClient shared across agent tools. */
export function getPayproofClient(): PayproofClient {
  if (!_client) {
    _client = createPayproofClient({
      evmPrivateKey: requireEnv("AGENT_PRIVATE_KEY", "set it in .env (hex, no 0x prefix)"),
      htlcContractAddress: requireEnv("HTLC_CONTRACT_ADDRESS", "deploy contracts/HTLC.sol and set the address in .env") as `0x${string}`,
      solanaPrivateKey: process.env.AGENT_SOLANA_PRIVATE_KEY,
      htlcSolanaProgramId: process.env.HTLC_SOLANA_PROGRAM_ID,
      solanaUsdcMint: process.env.SOLANA_USDC_MINT,
    });
  }
  return _client;
}

/**
 * @deprecated Use getPayproofClient() instead. Kept for backwards compat during migration.
 */
export const payproofClient = new Proxy({} as PayproofClient, {
  get(_target, prop) {
    return (getPayproofClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
