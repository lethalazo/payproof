import { NextResponse } from "next/server";
import { payproofClient } from "@/lib/client-instance";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [baseBalance, arcBalance] = await Promise.all([
      payproofClient.evmWallet.getBaseUSDCBalance().catch(() => "error"),
      payproofClient.arcWallet.getArcUSDCBalance().catch(() => "error"),
    ]);

    const address = payproofClient.evmWallet.account.address;

    return NextResponse.json({
      address,
      chains: [
        {
          name: "Base Sepolia",
          network: "eip155:84532",
          balance: baseBalance,
          symbol: "USDC",
          explorer: `https://sepolia.basescan.org/address/${address}`,
        },
        {
          name: "Arc Testnet",
          network: "eip155:5042002",
          balance: arcBalance,
          symbol: "USDC",
          explorer: `https://testnet.arcscan.app/address/${address}`,
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
