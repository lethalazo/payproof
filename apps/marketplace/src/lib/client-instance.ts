import { createPayproofClient } from "@payproof/client";

/** Singleton PayproofClient shared across agent tools. */
export const payproofClient = createPayproofClient({
  evmPrivateKey: process.env.AGENT_PRIVATE_KEY || "",
  htlcContractAddress: (process.env.HTLC_CONTRACT_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  solanaPrivateKey: process.env.AGENT_SOLANA_PRIVATE_KEY,
  htlcSolanaProgramId: process.env.HTLC_SOLANA_PROGRAM_ID,
  solanaUsdcMint: process.env.SOLANA_USDC_MINT,
});
