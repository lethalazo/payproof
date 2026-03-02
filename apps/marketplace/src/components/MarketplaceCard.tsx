"use client";

import type { MarketplaceAPI } from "@/lib/marketplace";

interface MarketplaceCardProps {
  api: MarketplaceAPI;
  purchased: boolean;
  onRequest: (endpoint: string) => void;
}

const NETWORK_COLORS: Record<string, string> = {
  blue: "bg-blue-900/40 text-blue-300 border-blue-700/30",
  purple: "bg-purple-900/40 text-purple-300 border-purple-700/30",
  orange: "bg-orange-900/40 text-orange-300 border-orange-700/30",
};

export default function MarketplaceCard({
  api,
  purchased,
  onRequest,
}: MarketplaceCardProps) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{api.icon}</span>
          <div>
            <h3 className="font-semibold text-white">{api.name}</h3>
            <span className="text-xs font-mono text-emerald-400">
              {api.price}
            </span>
          </div>
        </div>
        {purchased && (
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 mt-1" />
        )}
      </div>

      <p className="text-sm text-gray-400 mb-4 flex-1">{api.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {api.networks.map((net) => (
          <span
            key={net.network}
            className={`text-xs px-2 py-0.5 rounded-full border ${NETWORK_COLORS[net.color] || ""}`}
          >
            {net.label}
          </span>
        ))}
      </div>

      <button
        onClick={() => onRequest(api.endpoint)}
        className="w-full text-sm px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors"
      >
        Request via Agent
      </button>
    </div>
  );
}
