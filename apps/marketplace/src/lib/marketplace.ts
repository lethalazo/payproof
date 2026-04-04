// Marketplace API catalog - single source of truth for tools.ts and UI

import { getNetworkInfoForAPIs } from "./chain-config";

export interface MarketplaceAPI {
  endpoint: string;
  name: string;
  description: string;
  price: string;
  priceNum: number;
  icon: string;
  networks: { label: string; scheme: string; network: string; color: string }[];
}

/** API definitions without network info - networks are injected dynamically. */
const API_CATALOG = [
  {
    endpoint: "weather",
    name: "Weather Intelligence",
    description:
      "Agricultural weather data across major crop regions - temperature, precipitation, crop impact forecasts",
    price: "$0.001",
    priceNum: 0.001,
    icon: "🌦",
  },
  {
    endpoint: "markets",
    name: "Crypto Markets",
    description:
      "Crypto market data - prices, volume, market cap for BTC/ETH/SOL/USDC plus market indices",
    price: "$0.01",
    priceNum: 0.01,
    icon: "📊",
  },
  {
    endpoint: "sentiment",
    name: "Sentiment Analysis",
    description:
      "AI-powered sentiment analysis - social signals, whale activity, macro factors, per-asset breakdown",
    price: "$0.05",
    priceNum: 0.05,
    icon: "🧠",
  },
] as const;

/** Build MARKETPLACE_APIS with dynamic network lists from enabled chains. */
function buildMarketplaceAPIs(): MarketplaceAPI[] {
  const networks = getNetworkInfoForAPIs();
  return API_CATALOG.map((api) => ({ ...api, networks }));
}

export const MARKETPLACE_APIS: MarketplaceAPI[] = buildMarketplaceAPIs();

export const TOTAL_COST = MARKETPLACE_APIS.reduce((s, a) => s + a.priceNum, 0);

export function getAPIByEndpoint(endpoint: string): MarketplaceAPI | undefined {
  return MARKETPLACE_APIS.find((a) => a.endpoint === endpoint);
}
