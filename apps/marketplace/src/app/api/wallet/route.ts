import { NextResponse } from "next/server";
import { payproofClient } from "@/lib/client-instance";

export const runtime = "nodejs";

export async function GET() {
  const { evmWallet, arcWallet, solanaWallet } = payproofClient;

  try {
    const solAddress = solanaWallet?.getAddress() ?? "not configured";

    const [baseBalance, arcBalance, solBalance] = await Promise.all([
      evmWallet.getBaseUSDCBalance().catch(() => "error"),
      arcWallet.getArcUSDCBalance().catch(() => "error"),
      solanaWallet?.getUSDCBalance().catch(() => "error") ?? Promise.resolve("not configured"),
    ]);

    return NextResponse.json({
      address: evmWallet.account.address,
      chains: [
        {
          name: "Base Sepolia",
          network: "eip155:84532",
          balance: baseBalance,
          symbol: "USDC",
          explorer: `https://sepolia.basescan.org/address/${evmWallet.account.address}`,
        },
        {
          name: "Arc Testnet",
          network: "eip155:5042002",
          balance: arcBalance,
          symbol: "USDC",
          explorer: `https://testnet.arcscan.app/address/${evmWallet.account.address}`,
        },
        {
          name: "Solana Devnet",
          network: "solana:devnet",
          balance: solBalance,
          symbol: "USDC",
          address: solAddress,
          explorer:
            solAddress !== "not configured"
              ? `https://explorer.solana.com/address/${solAddress}?cluster=devnet`
              : undefined,
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch balances" },
      { status: 500 },
    );
  }
}
