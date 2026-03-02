import { config } from "dotenv";
import { resolve } from "path";

// Load environment from the marketplace .env.local
config({ path: resolve(__dirname, "../apps/marketplace/.env.local") });

const REQUIRED_VARS = [
  "AGENT_PRIVATE_KEY",
  "AGENT_SOLANA_PRIVATE_KEY",
  "MERCHANT_ADDRESS",
  "MERCHANT_PRIVATE_KEY",
  "MERCHANT_SOLANA_PRIVATE_KEY",
  "HTLC_CONTRACT_ADDRESS",
  "HTLC_SOLANA_PROGRAM_ID",
  "MERCHANT_SOL_ADDRESS",
];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  throw new Error(
    `Missing required env vars: ${missing.join(", ")}\n` +
    `Ensure apps/marketplace/.env.local exists with all keys set.`,
  );
}
