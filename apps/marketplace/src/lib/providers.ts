// Shared data generators — extracted from route handlers

export function generateWeatherData() {
  return {
    provider: "Payproof Weather Service",
    timestamp: new Date().toISOString(),
    regions: [
      {
        name: "US Midwest (Corn Belt)",
        temperature_f: 34 + Math.round(Math.random() * 10),
        humidity_pct: 55 + Math.round(Math.random() * 20),
        precipitation_in: +(Math.random() * 0.5).toFixed(2),
        wind_mph: 8 + Math.round(Math.random() * 12),
        forecast: "Cold front approaching. Frost risk elevated for next 48h.",
        crop_impact: "Potential frost damage to winter wheat. Monitor closely.",
      },
      {
        name: "Brazil (Mato Grosso)",
        temperature_f: 82 + Math.round(Math.random() * 8),
        humidity_pct: 70 + Math.round(Math.random() * 15),
        precipitation_in: +(Math.random() * 2).toFixed(2),
        wind_mph: 5 + Math.round(Math.random() * 8),
        forecast: "Rainy season continues. Above-average precipitation expected.",
        crop_impact: "Favorable for soybean development. Harvest may be delayed.",
      },
      {
        name: "Black Sea Region (Ukraine)",
        temperature_f: 28 + Math.round(Math.random() * 6),
        humidity_pct: 60 + Math.round(Math.random() * 15),
        precipitation_in: +(Math.random() * 0.3).toFixed(2),
        wind_mph: 12 + Math.round(Math.random() * 10),
        forecast: "Dry conditions persist. Below-normal snowpack.",
        crop_impact:
          "Drought risk for spring planting season. Wheat exports may tighten.",
      },
    ],
  };
}

export function generateMarketsData() {
  const btcBase = 95000 + Math.round(Math.random() * 5000);
  const ethBase = 3200 + Math.round(Math.random() * 400);

  return {
    provider: "Payproof Markets Service",
    timestamp: new Date().toISOString(),
    assets: [
      {
        symbol: "BTC",
        name: "Bitcoin",
        price_usd: btcBase,
        change_24h_pct: +((Math.random() - 0.5) * 6).toFixed(2),
        volume_24h_usd:
          28_000_000_000 + Math.round(Math.random() * 5_000_000_000),
        market_cap_usd: btcBase * 19_500_000,
        high_24h: btcBase + Math.round(Math.random() * 2000),
        low_24h: btcBase - Math.round(Math.random() * 2000),
      },
      {
        symbol: "ETH",
        name: "Ethereum",
        price_usd: ethBase,
        change_24h_pct: +((Math.random() - 0.5) * 8).toFixed(2),
        volume_24h_usd:
          12_000_000_000 + Math.round(Math.random() * 3_000_000_000),
        market_cap_usd: ethBase * 120_000_000,
        high_24h: ethBase + Math.round(Math.random() * 150),
        low_24h: ethBase - Math.round(Math.random() * 150),
      },
      {
        symbol: "SOL",
        name: "Solana",
        price_usd: +(140 + Math.random() * 30).toFixed(2),
        change_24h_pct: +((Math.random() - 0.5) * 10).toFixed(2),
        volume_24h_usd:
          3_000_000_000 + Math.round(Math.random() * 1_000_000_000),
        market_cap_usd: 65_000_000_000,
        high_24h: +(155 + Math.random() * 20).toFixed(2),
        low_24h: +(130 + Math.random() * 15).toFixed(2),
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        price_usd: 1.0,
        change_24h_pct: 0.0,
        volume_24h_usd: 8_000_000_000,
        market_cap_usd: 45_000_000_000,
        high_24h: 1.001,
        low_24h: 0.999,
      },
    ],
    indices: {
      total_market_cap_usd: 3_200_000_000_000,
      btc_dominance_pct: 58.4,
      defi_tvl_usd: 95_000_000_000,
      fear_greed_index: 45 + Math.round(Math.random() * 30),
    },
  };
}

export function generateSentimentData() {
  const signals = ["bullish", "bearish", "neutral"] as const;
  const pick = () => signals[Math.floor(Math.random() * signals.length)];

  return {
    provider: "Payproof Sentiment Analysis",
    timestamp: new Date().toISOString(),
    model_version: "v2.4.1",
    analysis: {
      overall_market: {
        signal: pick(),
        confidence: +(0.6 + Math.random() * 0.35).toFixed(2),
        summary:
          "Mixed signals across major assets. Institutional flows showing accumulation patterns while retail sentiment remains cautious after recent volatility.",
      },
      by_asset: [
        {
          symbol: "BTC",
          signal: pick(),
          confidence: +(0.55 + Math.random() * 0.4).toFixed(2),
          social_volume_change_pct: +((Math.random() - 0.3) * 40).toFixed(1),
          whale_activity:
            "Accumulation detected — 3 wallets moved 500+ BTC to cold storage",
          key_narratives: [
            "ETF inflow momentum continues",
            "Halving cycle thesis still dominant",
            "Regulatory clarity improving",
          ],
        },
        {
          symbol: "ETH",
          signal: pick(),
          confidence: +(0.5 + Math.random() * 0.4).toFixed(2),
          social_volume_change_pct: +((Math.random() - 0.4) * 30).toFixed(1),
          whale_activity: "Mixed — large sells offset by DeFi re-staking",
          key_narratives: [
            "L2 ecosystem growth accelerating",
            "Blob fee revenue scaling",
            "Pectra upgrade anticipation",
          ],
        },
        {
          symbol: "SOL",
          signal: pick(),
          confidence: +(0.45 + Math.random() * 0.45).toFixed(2),
          social_volume_change_pct: +((Math.random() - 0.2) * 50).toFixed(1),
          whale_activity: "Net accumulation trend over 7 days",
          key_narratives: [
            "DePIN narrative gaining traction",
            "Firedancer validator client progress",
            "Memecoin volume declining",
          ],
        },
      ],
      macro_factors: {
        fed_sentiment: "Hawkish hold — rate cuts delayed to H2",
        dollar_index_trend: "Strengthening",
        treasury_yield_10y: +(4.2 + Math.random() * 0.5).toFixed(2) + "%",
        risk_appetite: "Moderate — equity markets near ATH but bonds cautious",
      },
    },
  };
}
