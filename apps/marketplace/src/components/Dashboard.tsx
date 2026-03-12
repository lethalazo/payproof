"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AgentEvent, WalletInfo } from "@/lib/types";
import AgentChat from "./AgentChat";
import WalletCard from "./WalletCard";
import TransactionList from "./TransactionList";
import MarketplaceGrid from "./MarketplaceGrid";
import MerchantDashboard from "./MerchantDashboard";
import BudgetTracker from "./BudgetTracker";
import HowItWorks from "./HowItWorks";
import ProtocolSteps from "./ProtocolSteps";
import { TOTAL_COST } from "@/lib/marketplace";

interface WalletResponse {
  address: string;
  chains: (WalletInfo & { name: string; explorer: string; address?: string })[];
}

type Tab = "agent" | "marketplace" | "merchant";

const EXAMPLE_GOALS = [
  {
    label: "Crypto market analysis",
    goal: "Analyze current crypto market conditions. Buy market data and sentiment analysis, then provide a comprehensive overview with trading insights.",
    budget: "0.10",
  },
  {
    label: "Agricultural commodity outlook",
    goal: "Research weather impacts on global agricultural commodities. Focus on corn, soybeans, and wheat supply risks.",
    budget: "0.05",
  },
  {
    label: "Full data sweep",
    goal: "Purchase all available data sources, cross-reference them, and provide a unified macro outlook combining weather, markets, and sentiment signals.",
    budget: "0.10",
  },
];

export default function Dashboard() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("0.10");
  const [activeTab, setActiveTab] = useState<Tab>("agent");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet");
      if (res.ok) {
        setWallet(await res.json());
      }
    } catch {
      // ignore wallet fetch errors silently
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Auto-refresh wallet while agent is running
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(fetchWallet, 10_000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Final refresh when agent finishes
      fetchWallet();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, fetchWallet]);

  const startAgent = async () => {
    if (!goal.trim()) return;

    setEvents([]);
    setIsRunning(true);
    setActiveTab("agent");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, budget }),
      });

      if (!res.ok || !res.body) {
        setEvents([
          {
            type: "error",
            content: `Failed to start agent: ${res.status}`,
            timestamp: Date.now(),
          },
        ]);
        setIsRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: AgentEvent = JSON.parse(line.slice(6));
              setEvents((prev) => [...prev, event]);
            } catch {
              // skip malformed SSE
            }
          }
        }
      }
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        {
          type: "error" as const,
          content: err instanceof Error ? err.message : "Connection lost",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleMarketplaceRequest = (endpoint: string) => {
    setGoal(`Purchase and analyze ${endpoint} data from the marketplace.`);
    setActiveTab("agent");
  };

  const budgetNum = parseFloat(budget);
  const budgetWarning = !isNaN(budgetNum) && budgetNum < TOTAL_COST;

  const accentForChain = (name: string) => {
    if (name.includes("Base")) return "blue";
    if (name.includes("Arc")) return "purple";
    if (name.includes("Solana")) return "orange";
    return "blue";
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Payproof</h1>
            <p className="text-sm text-gray-400">
              AI agent with autonomous USDC micropayments via x402
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <HowItWorks />
            <span className="px-2 py-1 bg-blue-900/30 rounded text-blue-400 border border-blue-800/30">
              Base Sepolia
            </span>
            <span className="px-2 py-1 bg-purple-900/30 rounded text-purple-400 border border-purple-800/30">
              Arc Testnet
            </span>
            <span className="px-2 py-1 bg-orange-900/30 rounded text-orange-400 border border-orange-800/30">
              Solana Devnet
            </span>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          <button
            onClick={() => setActiveTab("agent")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "agent"
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Agent
          </button>
          <button
            onClick={() => setActiveTab("marketplace")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "marketplace"
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Marketplace
          </button>
          <button
            onClick={() => setActiveTab("merchant")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "merchant"
                ? "border-green-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Merchant
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Input Section */}
        <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">
                Research Goal
              </label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What should the agent research?"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                disabled={isRunning}
              />
            </div>
            <div className="w-full md:w-32">
              <label className="text-xs text-gray-400 mb-1 block">
                Budget (USDC)
              </label>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.10"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                disabled={isRunning}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={startAgent}
                disabled={isRunning || !goal.trim()}
                className="w-full md:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
              >
                {isRunning ? "Running..." : "Start Agent"}
              </button>
            </div>
          </div>

          {budgetWarning && (
            <p className="text-xs text-amber-400 mt-2">
              Budget is below ${TOTAL_COST.toFixed(3)} — may not be enough to buy all three data
              sources.
            </p>
          )}

          {/* Example goals */}
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLE_GOALS.map((ex) => (
              <button
                key={ex.label}
                onClick={() => {
                  setGoal(ex.goal);
                  setBudget(ex.budget);
                }}
                disabled={isRunning}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-50 transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "merchant" ? (
          <MerchantDashboard />
        ) : activeTab === "marketplace" ? (
          <MarketplaceGrid events={events} onRequest={handleMarketplaceRequest} />
        ) : (
          <>
            {/* Protocol Steps Visualizer */}
            <ProtocolSteps events={events} />

            {/* Budget Tracker */}
            <BudgetTracker events={events} budget={budget} />

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Agent Chat — Left/Wide */}
              <div className="lg:col-span-2 bg-gray-900 rounded-lg border border-gray-800 h-[600px] flex flex-col">
                <div className="px-4 py-3 border-b border-gray-800 text-sm font-medium text-gray-300">
                  Agent Activity
                </div>
                <div className="flex-1 overflow-hidden">
                  <AgentChat events={events} isRunning={isRunning} />
                </div>
              </div>

              {/* Right Sidebar */}
              <div className="space-y-4">
                {/* Wallet Cards */}
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    Wallets
                  </h3>
                  {wallet ? (
                    <div className="space-y-3">
                      {wallet.chains.map((chain) => (
                        <WalletCard
                          key={chain.name}
                          name={chain.name}
                          address={chain.address || wallet.address}
                          balance={chain.balance}
                          symbol={chain.symbol}
                          explorer={chain.explorer}
                          accent={accentForChain(chain.name)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 animate-pulse">
                      Loading wallets...
                    </div>
                  )}
                </div>

                {/* Transaction History */}
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    Transactions
                  </h3>
                  <TransactionList events={events} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
