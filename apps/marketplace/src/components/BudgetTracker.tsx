"use client";

import type { AgentEvent } from "@/lib/types";
import { MARKETPLACE_APIS } from "@/lib/marketplace";

interface BudgetTrackerProps {
  events: AgentEvent[];
  budget: string;
}

function getSpent(events: AgentEvent[]): number {
  let total = 0;
  for (const event of events) {
    if (event.type !== "tool_result") continue;
    try {
      const data = JSON.parse(event.content);
      if (data.success && data.endpoint) {
        const api = MARKETPLACE_APIS.find((a) => a.endpoint === data.endpoint);
        if (api) total += api.priceNum;
      }
    } catch {
      // skip
    }
  }
  return total;
}

export default function BudgetTracker({ events, budget }: BudgetTrackerProps) {
  const budgetNum = parseFloat(budget) || 0;
  const spent = getSpent(events);
  const remaining = Math.max(0, budgetNum - spent);
  const pct = budgetNum > 0 ? Math.min(100, (spent / budgetNum) * 100) : 0;

  if (spent === 0 && events.length === 0) return null;

  return (
    <div className="mb-4 bg-gray-900 rounded-lg border border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex gap-4">
          <span className="text-gray-400">
            Budget:{" "}
            <span className="text-white font-mono">
              ${budgetNum.toFixed(3)}
            </span>
          </span>
          <span className="text-gray-400">
            Spent:{" "}
            <span className="text-amber-400 font-mono">
              ${spent.toFixed(3)}
            </span>
          </span>
          <span className="text-gray-400">
            Remaining:{" "}
            <span className="text-emerald-400 font-mono">
              ${remaining.toFixed(3)}
            </span>
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct > 90 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
