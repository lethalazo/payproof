import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { arcTestnet } from "@payproof/contracts";
import { payproofServer } from "@/lib/server-instance";

export const runtime = "nodejs";

const USDC_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const USDC_ARC = "0x3600000000000000000000000000000000000000" as const;

const basePublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

async function getBaseBalance(address: `0x${string}`): Promise<string> {
  const balance = await basePublicClient.readContract({
    address: USDC_BASE_SEPOLIA,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  return formatUnits(balance, 6);
}

async function getArcBalance(address: `0x${string}`): Promise<string> {
  const balance = await arcPublicClient.readContract({
    address: USDC_ARC,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  return formatUnits(balance, 6);
}

export async function GET() {
  const merchantEVM = (process.env.MERCHANT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

  try {
    const [baseBalance, arcBalance] = await Promise.all([
      getBaseBalance(merchantEVM).catch(() => "error"),
      getArcBalance(merchantEVM).catch(() => "error"),
    ]);

    const revenue = await payproofServer.ledgerStore.getRevenueSummary();

    return NextResponse.json({
      address: merchantEVM,
      chains: [
        {
          name: "Base Sepolia",
          network: "eip155:84532",
          balance: baseBalance,
          symbol: "USDC",
          address: merchantEVM,
          explorer: `https://sepolia.basescan.org/address/${merchantEVM}`,
          revenue: revenue["Base Sepolia"] || 0,
        },
        {
          name: "Arc Testnet",
          network: "eip155:5042002",
          balance: arcBalance,
          symbol: "USDC",
          address: merchantEVM,
          explorer: `https://testnet.arcscan.app/address/${merchantEVM}`,
          revenue: revenue["Arc Testnet"] || 0,
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch merchant balances" },
      { status: 500 },
    );
  }
}
