"use client";

interface Asset {
  symbol: string;
  name: string;
  price_usd: number;
  change_24h_pct: number | string;
  volume_24h_usd: number;
  market_cap_usd: number;
  high_24h: number;
  low_24h: number;
}

interface MarketsData {
  provider: string;
  timestamp: string;
  assets: Asset[];
  indices: {
    total_market_cap_usd: number;
    btc_dominance_pct: number;
    defi_tvl_usd: number;
    fear_greed_index: number;
  };
}

function formatUSD(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000) return `$${n.toLocaleString()}`;
  return `$${n.toFixed(2)}`;
}

function fearGreedColor(index: number): string {
  if (index <= 25) return "text-red-400";
  if (index <= 45) return "text-orange-400";
  if (index <= 55) return "text-yellow-400";
  if (index <= 75) return "text-emerald-400";
  return "text-green-400";
}

function fearGreedLabel(index: number): string {
  if (index <= 25) return "Extreme Fear";
  if (index <= 45) return "Fear";
  if (index <= 55) return "Neutral";
  if (index <= 75) return "Greed";
  return "Extreme Greed";
}

export default function MarketsViz({ data }: { data: MarketsData }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📊</span>
        <span className="text-sm font-medium text-gray-200">
          {data.provider}
        </span>
        <span className="text-xs text-gray-500 ml-auto">
          {new Date(data.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {data.assets.map((asset) => {
          const change = Number(asset.change_24h_pct);
          const isUp = change >= 0;

          return (
            <div
              key={asset.symbol}
              className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-white">
                  {asset.symbol}
                </span>
                <span
                  className={`text-xs font-mono ${isUp ? "text-emerald-400" : "text-red-400"}`}
                >
                  {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                </span>
              </div>
              <div className="text-xl font-bold text-white">
                {formatUSD(asset.price_usd)}
              </div>
              <div className="flex gap-3 text-xs text-gray-500 mt-1">
                <span>Vol {formatUSD(asset.volume_24h_usd)}</span>
                <span>MCap {formatUSD(asset.market_cap_usd)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Indices Bar */}
      <div className="flex items-center gap-4 bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/50 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Fear/Greed:</span>
          <span
            className={`font-bold ${fearGreedColor(data.indices.fear_greed_index)}`}
          >
            {data.indices.fear_greed_index}
          </span>
          <span className="text-gray-500">
            ({fearGreedLabel(data.indices.fear_greed_index)})
          </span>
        </div>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">
          BTC Dom: {data.indices.btc_dominance_pct}%
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">
          DeFi TVL: {formatUSD(data.indices.defi_tvl_usd)}
        </span>
      </div>
    </div>
  );
}
