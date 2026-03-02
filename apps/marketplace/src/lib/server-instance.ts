import { createPayproofServer } from "@payproof/server";

const MERCHANT_ADDRESS =
  process.env.MERCHANT_ADDRESS || "0x0000000000000000000000000000000000000000";
const MERCHANT_SOL_ADDRESS =
  process.env.MERCHANT_SOL_ADDRESS || MERCHANT_ADDRESS;
const TREASURY_ADDRESS =
  process.env.TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000";

/** Singleton PayproofServer shared across middleware and API routes. */
export const payproofServer = createPayproofServer({
  merchantEvmAddress: MERCHANT_ADDRESS,
  merchantEvmPrivateKey: process.env.MERCHANT_PRIVATE_KEY || "",
  merchantSolAddress: MERCHANT_SOL_ADDRESS,
  merchantSolanaPrivateKey: process.env.MERCHANT_SOLANA_PRIVATE_KEY,
  htlcContractAddress: (process.env.HTLC_CONTRACT_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  htlcSolanaProgramId: process.env.HTLC_SOLANA_PROGRAM_ID,
  solanaUsdcMint: process.env.SOLANA_USDC_MINT,
  treasuryAddress: TREASURY_ADDRESS,
});
