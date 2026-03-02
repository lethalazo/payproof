"use client";

import { useState, useEffect, useCallback } from "react";
import WalletCard from "./WalletCard";

interface MerchantChain {
  name: string;
  network: string;
  balance: string;
  symbol: string;
  address: string;
  explorer?: string;
  revenue: number;
}

interface MerchantData {
  address: string;
  solAddress: string;
  chains: MerchantChain[];
}

interface MerchantTx {
  id: string;
  timestamp: number;
  network: string;
  chain: string;
  txHash: string;
  amount: string;
  payer?: string;
  endpoint?: string;
  type: string;
}

const accentForChain = (name: string): "blue" | "purple" | "orange" => {
  if (name.includes("Base")) return "blue";
  if (name.includes("Arc")) return "purple";
  if (name.includes("Solana")) return "orange";
  return "blue";
};

function explorerTxUrl(chain: string, txHash: string): string | undefined {
  if (chain.includes("Base"))
    return `https://sepolia.basescan.org/tx/${txHash}`;
  if (chain.includes("Arc"))
    return `https://testnet.arcscan.app/tx/${txHash}`;
  if (chain.includes("Solana"))
    return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  return undefined;
}

function chainBadge(chain: string): { bg: string; text: string } {
  if (chain.includes("Base"))
    return { bg: "bg-blue-900/50", text: "text-blue-300" };
  if (chain.includes("Arc"))
    return { bg: "bg-purple-900/50", text: "text-purple-300" };
  if (chain.includes("Solana"))
    return { bg: "bg-orange-900/50", text: "text-orange-300" };
  return { bg: "bg-gray-900/50", text: "text-gray-300" };
}

export default function MerchantDashboard() {
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [transactions, setTransactions] = useState<MerchantTx[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        fetch("/api/merchant"),
        fetch("/api/merchant/transactions"),
      ]);
      if (balRes.ok) setMerchant(await balRes.json());
      if (txRes.ok) {
        const data = await txRes.json();
        setTransactions(data.transactions || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalRevenue = merchant?.chains.reduce((s, c) => s + c.revenue, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Revenue Summary */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Merchant Overview
          </h2>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Total Revenue
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${totalRevenue.toFixed(6)}
            </div>
          </div>
        </div>

        {/* Balance Cards */}
        {loading ? (
          <div className="text-sm text-gray-500 animate-pulse">
            Loading merchant balances...
          </div>
        ) : merchant ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {merchant.chains.map((chain) => (
              <div key={chain.name} className="relative">
                <WalletCard
                  name={chain.name}
                  address={chain.address}
                  balance={chain.balance}
                  symbol={chain.symbol}
                  explorer={chain.explorer || ""}
                  accent={accentForChain(chain.name)}
                />
                {chain.revenue > 0 && (
                  <div className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-300 font-mono">
                    +${chain.revenue.toFixed(4)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-red-400">
            Failed to load merchant data
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">
            Transaction History
          </h3>
          <span className="text-xs text-gray-500">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No settlements yet. Transactions will appear here after agent
            purchases via x402.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {transactions.map((tx) => {
              const badge = chainBadge(tx.chain);
              const explorerUrl = explorerTxUrl(tx.chain, tx.txHash);
              return (
                <div
                  key={tx.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-mono ${badge.bg} ${badge.text}`}
                      >
                        {tx.type}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}
                      >
                        {tx.chain}
                      </span>
                      {tx.endpoint && (
                        <span className="text-xs text-gray-400">
                          {tx.endpoint}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 font-mono truncate">
                      {tx.txHash.slice(0, 16)}...{tx.txHash.slice(-8)}
                    </div>
                    {tx.payer && (
                      <div className="text-xs text-gray-600 mt-0.5">
                        from {tx.payer.slice(0, 8)}...{tx.payer.slice(-4)}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <div className="text-white font-mono font-medium">
                      +${tx.amount}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </div>
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        View tx
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
