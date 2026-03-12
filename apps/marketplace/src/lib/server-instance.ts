import { createPayproofServer, type PayproofServer } from "@payproof/server";

let _server: PayproofServer | null = null;

function requireEnv(name: string, hint: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} is required — ${hint}`);
  return val;
}

/** Lazily-initialized singleton PayproofServer shared across middleware and API routes. */
export function getPayproofServer(): PayproofServer {
  if (!_server) {
    const merchantAddress = requireEnv("MERCHANT_ADDRESS", "set the EVM merchant address in .env");
    const treasuryAddress = requireEnv("TREASURY_ADDRESS", "set the treasury address in .env");

    _server = createPayproofServer({
      merchantEvmAddress: merchantAddress,
      merchantEvmPrivateKey: requireEnv("MERCHANT_PRIVATE_KEY", "set the merchant private key in .env"),
      htlcContractAddress: requireEnv("HTLC_CONTRACT_ADDRESS", "deploy contracts/HTLC.sol and set the address in .env") as `0x${string}`,
      treasuryAddress,
    });
  }
  return _server;
}

/**
 * @deprecated Use getPayproofServer() instead. Kept for backwards compat during migration.
 */
export const payproofServer = new Proxy({} as PayproofServer, {
  get(_target, prop) {
    return (getPayproofServer() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
