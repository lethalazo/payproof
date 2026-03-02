"use client";

interface AssetSentiment {
  symbol: string;
  signal: string;
  confidence: number;
  social_volume_change_pct: number | string;
  whale_activity: string;
  key_narratives: string[];
}

interface SentimentData {
  provider: string;
  timestamp: string;
  model_version: string;
  analysis: {
    overall_market: {
      signal: string;
      confidence: number;
      summary: string;
    };
    by_asset: AssetSentiment[];
    macro_factors: {
      fed_sentiment: string;
      dollar_index_trend: string;
      treasury_yield_10y: string;
      risk_appetite: string;
    };
  };
}

function signalColor(signal: string): string {
  switch (signal) {
    case "bullish":
      return "text-emerald-400";
    case "bearish":
      return "text-red-400";
    default:
      return "text-yellow-400";
  }
}

function signalBg(signal: string): string {
  switch (signal) {
    case "bullish":
      return "bg-emerald-900/40 border-emerald-700/30";
    case "bearish":
      return "bg-red-900/40 border-red-700/30";
    default:
      return "bg-yellow-900/40 border-yellow-700/30";
  }
}

function confidenceBarColor(signal: string): string {
  switch (signal) {
    case "bullish":
      return "bg-emerald-400";
    case "bearish":
      return "bg-red-400";
    default:
      return "bg-yellow-400";
  }
}

export default function SentimentViz({ data }: { data: SentimentData }) {
  const { overall_market, by_asset } = data.analysis;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🧠</span>
        <span className="text-sm font-medium text-gray-200">
          {data.provider}
        </span>
        <span className="text-xs text-gray-500 ml-auto">
          {data.model_version}
        </span>
      </div>

      {/* Overall Signal */}
      <div
        className={`rounded-lg p-3 border mb-3 ${signalBg(overall_market.signal)}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Overall:</span>
            <span
              className={`text-sm font-bold uppercase ${signalColor(overall_market.signal)}`}
            >
              {overall_market.signal}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {(overall_market.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full ${confidenceBarColor(overall_market.signal)}`}
            style={{ width: `${overall_market.confidence * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">{overall_market.summary}</p>
      </div>

      {/* Per-Asset Breakdown */}
      <div className="space-y-2">
        {by_asset.map((asset) => (
          <div
            key={asset.symbol}
            className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {asset.symbol}
                </span>
                <span
                  className={`text-xs font-bold uppercase ${signalColor(asset.signal)}`}
                >
                  {asset.signal}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {(asset.confidence * 100).toFixed(0)}%
              </span>
            </div>

            <div className="h-1 bg-gray-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full ${confidenceBarColor(asset.signal)}`}
                style={{ width: `${asset.confidence * 100}%` }}
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>
                🐋{" "}
                {asset.whale_activity.length > 40
                  ? asset.whale_activity.slice(0, 40) + "..."
                  : asset.whale_activity}
              </span>
              <span className="ml-auto text-gray-500">
                Social:{" "}
                {Number(asset.social_volume_change_pct) > 0 ? "+" : ""}
                {Number(asset.social_volume_change_pct).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
