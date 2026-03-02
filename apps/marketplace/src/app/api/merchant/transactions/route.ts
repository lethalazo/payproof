import { NextResponse } from "next/server";
import { payproofServer } from "@/lib/server-instance";
import type { MerchantTransaction } from "@payproof/contracts";

export const runtime = "nodejs";

export async function GET() {
  const transactions = await payproofServer.ledgerStore.getAll();
  return NextResponse.json({ transactions });
}

export async function POST(req: Request) {
  try {
    const tx = (await req.json()) as MerchantTransaction;

    if (!tx.id || !tx.txHash || !tx.chain || !tx.amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await payproofServer.ledgerStore.record(tx);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request" },
      { status: 400 },
    );
  }
}
