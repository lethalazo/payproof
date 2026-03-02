"use client";

import type { AgentEvent } from "@/lib/types";

interface TransactionListProps {
  events: AgentEvent[];
}

interface ParsedTx {
  time: string;
  chain: string;
  type: string;
  amount: string;
  description: string;
  explorer?: string;
  status?: string;
  sender?: string;
  receiver?: string;
  txHash?: string;
}

function chainBadge(chain: string): string {
  if (chain.includes("Base")) return "bg-blue-900/50 text-blue-300";
  if (chain.includes("Arc")) return "bg-purple-900/50 text-purple-300";
  if (chain.includes("Solana")) return "bg-orange-900/50 text-orange-300";
  return "bg-gray-900/50 text-gray-300";
}

function statusBadge(status: string): string {
  if (status === "claimed" || status === "completed") return "bg-green-900/50 text-green-300";
  if (status === "failed" || status === "error") return "bg-red-900/50 text-red-300";
  return "bg-yellow-900/50 text-yellow-300";
}

function extractTransactions(events: AgentEvent[]): ParsedTx[] {
  const txs: ParsedTx[] = [];

  for (const event of events) {
    if (event.type !== "tool_result") continue;

    try {
      const data = JSON.parse(event.content);

      // x402 payment (fetch_paid_data success with payment metadata)
      if (data.endpoint && data.payment) {
        txs.push({
          time: new Date(data.payment.timestamp || event.timestamp).toLocaleTimeString(),
          chain: data.payment.chain || "Unknown",
          type: "x402",
          amount: data.payment.amount || "?",
          description: `Purchased ${data.endpoint} data`,
          explorer: data.payment.explorerUrl || undefined,
          status: data.payment.status || (data.success ? "completed" : "failed"),
          sender: data.payment.sender,
          receiver: data.payment.receiver,
          txHash: data.payment.txHash,
        });
        continue;
      }

      // x402 payment failure (no payment object but has endpoint)
      if (data.endpoint && !data.success && data.error) {
        txs.push({
          time: new Date(data.timestamp || event.timestamp).toLocaleTimeString(),
          chain: data.settlement?.chain || "Unknown",
          type: "x402",
          amount: data.amount || "?",
          description: `Failed: ${data.endpoint} — ${data.error}`,
          status: "failed",
        });
        continue;
      }

      // Arc transfer
      if (data.success && data.txHash && data.chain === "Arc Testnet") {
        txs.push({
          time: new Date(event.timestamp).toLocaleTimeString(),
          chain: "Arc Testnet",
          type: "transfer",
          amount: data.amount,
          description: `Transfer to ${data.to?.slice(0, 8)}...`,
          explorer: data.explorer,
          status: "completed",
          txHash: data.txHash,
        });
      }
    } catch {
      // not JSON, skip
    }
  }

  return txs;
}

export default function TransactionList({ events }: TransactionListProps) {
  const txs = extractTransactions(events);

  if (txs.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm py-4">
        No transactions yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {txs.map((tx, i) => (
        <div
          key={i}
          className="text-sm bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${chainBadge(tx.chain)}`}
              >
                {tx.chain}
              </span>
              {tx.status && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${statusBadge(tx.status)}`}
                >
                  {tx.status}
                </span>
              )}
            </div>
            <div className="text-white font-mono font-medium ml-2 shrink-0">
              ${tx.amount}
            </div>
          </div>
          <div className="text-gray-300 text-xs mt-1 truncate">{tx.description}</div>
          {tx.txHash && (
            <div className="text-[10px] text-gray-500 mt-0.5 font-mono truncate">
              {tx.txHash.slice(0, 16)}...{tx.txHash.slice(-8)}
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-600">{tx.time}</span>
            {tx.explorer && (
              <a
                href={tx.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                View tx
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
