import { describe, it, expect } from "vitest";
import { MemoryLedgerStore } from "@payproof/server";
import type { MerchantTransaction } from "@payproof/contracts";

function makeTx(overrides: Partial<MerchantTransaction> = {}): MerchantTransaction {
  return {
    id: "0x" + Math.random().toString(16).slice(2),
    timestamp: Date.now(),
    network: "eip155:5042002",
    chain: "Arc Testnet",
    txHash: "0x" + "ab".repeat(32),
    amount: "0.001",
    type: "htlc-claim",
    ...overrides,
  };
}

describe("MemoryLedgerStore", () => {
  it("records and retrieves transactions", () => {
    const store = new MemoryLedgerStore();
    const tx = makeTx();
    store.record(tx);

    const all = store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(tx);
  });

  it("returns transactions in reverse chronological order", () => {
    const store = new MemoryLedgerStore();
    store.record(makeTx({ id: "first", timestamp: 1000 }));
    store.record(makeTx({ id: "second", timestamp: 2000 }));
    store.record(makeTx({ id: "third", timestamp: 3000 }));

    const all = store.getAll();
    expect(all[0].id).toBe("third");
    expect(all[1].id).toBe("second");
    expect(all[2].id).toBe("first");
  });

  it("getRevenueSummary aggregates by chain", () => {
    const store = new MemoryLedgerStore();
    store.record(makeTx({ chain: "Arc Testnet", amount: "0.001" }));
    store.record(makeTx({ chain: "Arc Testnet", amount: "0.01" }));
    store.record(makeTx({ chain: "Solana Devnet", amount: "0.05" }));

    const summary = store.getRevenueSummary();
    expect(summary["Arc Testnet"]).toBeCloseTo(0.011, 5);
    expect(summary["Solana Devnet"]).toBeCloseTo(0.05, 5);
  });
});
