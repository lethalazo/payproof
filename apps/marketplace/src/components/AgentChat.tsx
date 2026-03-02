"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/types";
import WeatherViz from "./viz/WeatherViz";
import MarketsViz from "./viz/MarketsViz";
import SentimentViz from "./viz/SentimentViz";

interface AgentChatProps {
  events: AgentEvent[];
  isRunning: boolean;
}

function tryParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function CollapsibleJSON({
  data,
  label,
}: {
  data: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = tryParseJSON(data);

  if (!parsed) {
    return <p className="text-sm text-gray-300 whitespace-pre-wrap">{data}</p>;
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
      >
        <span className="font-mono">{open ? "▼" : "▶"}</span> {label}
      </button>
      {open && (
        <pre className="mt-2 text-xs bg-black/30 rounded p-2 overflow-x-auto max-h-64 overflow-y-auto text-gray-300">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )}
    </div>
  );
}

function BalanceCard({ data }: { data: Record<string, unknown> }) {
  if (data.chains && Array.isArray(data.chains)) {
    // Multi-chain balance
    return (
      <div className="flex flex-wrap gap-2">
        {(data.chains as Record<string, unknown>[]).map(
          (chain: Record<string, unknown>, i: number) => (
            <div
              key={i}
              className="bg-gray-800/50 rounded px-3 py-2 border border-gray-700/50 text-xs"
            >
              <div className="text-gray-400">{String(chain.chain)}</div>
              <div className="text-white font-mono text-sm">
                {String(chain.usdc_balance)} USDC
              </div>
              {"note" in chain && chain.note ? (
                <div className="text-gray-500 mt-0.5">
                  {String(chain.note)}
                </div>
              ) : null}
            </div>
          ),
        )}
      </div>
    );
  }
  // Single chain balance
  return (
    <div className="bg-gray-800/50 rounded px-3 py-2 border border-gray-700/50 text-xs inline-block">
      <div className="text-gray-400">{String(data.chain)}</div>
      <div className="text-white font-mono text-sm">
        {String(data.usdc_balance)} USDC
      </div>
    </div>
  );
}

function ApiCards({ data }: { data: Record<string, unknown> }) {
  const apis = data.apis as Record<string, unknown>[];
  if (!apis) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {apis.map((api: Record<string, unknown>, i: number) => (
        <div
          key={i}
          className="bg-gray-800/50 rounded px-3 py-2 border border-gray-700/50 text-xs flex-1 min-w-[150px]"
        >
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-white font-medium">
              {String(api.endpoint)}
            </span>
            <span className="text-emerald-400 font-mono">
              {String(api.price)}
            </span>
          </div>
          <div className="text-gray-500 text-[11px] leading-tight">
            {String(api.description).slice(0, 60)}...
          </div>
        </div>
      ))}
    </div>
  );
}

function renderToolResult(event: AgentEvent) {
  const parsed = tryParseJSON(event.content) as Record<string, unknown> | null;
  if (!parsed) {
    return <CollapsibleJSON data={event.content} label="View response data" />;
  }

  // Viz dispatch for fetch_paid_data results
  if (
    event.toolName === "fetch_paid_data" &&
    parsed.success &&
    parsed.data
  ) {
    const apiData = parsed.data as Record<string, unknown>;
    const endpoint = parsed.endpoint as string;

    if (endpoint === "weather" && apiData.regions) {
      return <WeatherViz data={apiData as never} />;
    }
    if (endpoint === "markets" && apiData.assets) {
      return <MarketsViz data={apiData as never} />;
    }
    if (endpoint === "sentiment" && apiData.analysis) {
      return <SentimentViz data={apiData as never} />;
    }
  }

  // Balance cards
  if (
    (event.toolName === "check_wallet_balance" ||
      event.toolName === "check_arc_balance" ||
      event.toolName === "check_solana_balance") &&
    (parsed.usdc_balance || parsed.chains)
  ) {
    return <BalanceCard data={parsed} />;
  }

  // API listing
  if (event.toolName === "list_available_apis" && parsed.apis) {
    return <ApiCards data={parsed} />;
  }

  // Fallback
  return <CollapsibleJSON data={event.content} label="View response data" />;
}

export default function AgentChat({ events, isRunning }: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  if (events.length === 0 && !isRunning) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Start a research task to see the agent in action</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 overflow-y-auto h-full">
      {events.map((event, i) => {
        switch (event.type) {
          case "text":
            return (
              <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <p className="text-sm text-gray-200 whitespace-pre-wrap">
                  {event.content}
                </p>
              </div>
            );

          case "tool_call":
            return (
              <div
                key={i}
                className="bg-amber-950/30 rounded-lg p-3 border border-amber-700/40"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-amber-800/40 rounded text-amber-300">
                    TOOL
                  </span>
                  <span className="text-sm font-medium text-amber-200">
                    {event.toolName}
                  </span>
                </div>
                {event.toolInput &&
                  Object.keys(event.toolInput).length > 0 && (
                    <pre className="text-xs text-amber-300/70 mt-1">
                      {JSON.stringify(event.toolInput, null, 2)}
                    </pre>
                  )}
              </div>
            );

          case "tool_result":
            return (
              <div
                key={i}
                className="bg-emerald-950/30 rounded-lg p-3 border border-emerald-700/40"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-emerald-800/40 rounded text-emerald-300">
                    RESULT
                  </span>
                  <span className="text-sm text-emerald-200">
                    {event.toolName}
                  </span>
                </div>
                {renderToolResult(event)}
              </div>
            );

          case "error":
            return (
              <div
                key={i}
                className="bg-red-950/30 rounded-lg p-3 border border-red-700/40"
              >
                <span className="text-xs font-mono px-1.5 py-0.5 bg-red-800/40 rounded text-red-300">
                  ERROR
                </span>
                <p className="text-sm text-red-200 mt-1">{event.content}</p>
              </div>
            );

          case "done":
            return (
              <div
                key={i}
                className="text-center text-sm text-gray-500 py-2 border-t border-gray-800"
              >
                Agent completed
              </div>
            );

          default:
            return null;
        }
      })}

      {isRunning && (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          Agent is thinking...
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
