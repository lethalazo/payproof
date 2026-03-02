import type { MerchantTransaction } from "@payproof/contracts";

/** Store interface for merchant settlement transaction ledger. */
export interface LedgerStore {
  record(tx: MerchantTransaction): void | Promise<void>;
  getAll(): MerchantTransaction[] | Promise<MerchantTransaction[]>;
  getRevenueSummary(): Record<string, number> | Promise<Record<string, number>>;
}

/** In-memory LedgerStore. */
export class MemoryLedgerStore implements LedgerStore {
  private transactions: MerchantTransaction[] = [];

  record(tx: MerchantTransaction): void {
    this.transactions.push(tx);
  }

  getAll(): MerchantTransaction[] {
    return [...this.transactions].reverse();
  }

  getRevenueSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const tx of this.transactions) {
      summary[tx.chain] = (summary[tx.chain] || 0) + parseFloat(tx.amount);
    }
    return summary;
  }
}
