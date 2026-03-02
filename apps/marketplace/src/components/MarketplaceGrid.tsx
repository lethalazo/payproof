"use client";

import { MARKETPLACE_APIS } from "@/lib/marketplace";
import type { AgentEvent } from "@/lib/types";
import MarketplaceCard from "./MarketplaceCard";

interface MarketplaceGridProps {
  events: AgentEvent[];
  onRequest: (endpoint: string) => void;
}

function getPurchasedEndpoints(events: AgentEvent[]): Set<string> {
  const purchased = new Set<string>();
  for (const event of events) {
    if (event.type !== "tool_result") continue;
    try {
      const data = JSON.parse(event.content);
      if (data.success && data.endpoint) {
        purchased.add(data.endpoint);
      }
    } catch {
      // skip
    }
  }
  return purchased;
}

export default function MarketplaceGrid({
  events,
  onRequest,
}: MarketplaceGridProps) {
  const purchased = getPurchasedEndpoints(events);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {MARKETPLACE_APIS.map((api) => (
        <MarketplaceCard
          key={api.endpoint}
          api={api}
          purchased={purchased.has(api.endpoint)}
          onRequest={onRequest}
        />
      ))}
    </div>
  );
}
