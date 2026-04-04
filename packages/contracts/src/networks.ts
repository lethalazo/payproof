import { defineChain, parseAbi } from "viem";

/** Chain configuration for the Payproof protocol. */
export interface ChainConfig {
  /** CAIP-2 chain ID, e.g. "eip155:5042002", "solana:devnet". */
  id: string;
  /** Human-readable label, e.g. "Arc Testnet". */
  label: string;
  /** Chain family - determines which HTLC client to use. */
  family: "evm" | "solana";
  /** Payment scheme: "direct" (HTLC) or "exact" (Permit2/facilitator). */
  scheme: "direct" | "exact";
  /** USDC token config on this chain. */
  usdc: { address: string; decimals: number };
  /** Block explorer base URL. */
  explorer?: string;
  /** UI color hint. */
  color?: string;
}

/** Central chain registry - single source of truth for all supported chains. */
export const CHAIN_REGISTRY: Record<string, ChainConfig> = {
  "eip155:84532": {
    id: "eip155:84532",
    label: "Base Sepolia",
    family: "evm",
    scheme: "exact",
    usdc: { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
    explorer: "https://sepolia.basescan.org",
    color: "blue",
  },
  "eip155:5042002": {
    id: "eip155:5042002",
    label: "Arc Testnet",
    family: "evm",
    scheme: "direct",
    usdc: { address: "0x3600000000000000000000000000000000000000", decimals: 6 },
    explorer: "https://testnet.arcscan.app",
    color: "purple",
  },
  "solana:devnet": {
    id: "solana:devnet",
    label: "Solana Devnet",
    family: "solana",
    scheme: "direct",
    usdc: { address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 },
    explorer: "https://explorer.solana.com",
    color: "orange",
  },
};

/** ERC-20 ABI subset for USDC operations. */
export const USDC_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

/** USDC asset config per chain. */
export interface USDCAsset {
  address: string;
  decimals: number;
}

/** USDC asset addresses per supported network. */
export const USDC_ASSETS: Record<string, USDCAsset> = {
  "eip155:84532": {
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
  },
  "eip155:5042002": {
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
  },
  "solana:devnet": {
    address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    decimals: 6,
  },
};

/** Arc Testnet chain definition for viem. */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

/** Explorer URL helpers per chain. */
export const EXPLORER_URLS: Record<string, { tx: (hash: string) => string; address: (addr: string) => string }> = {
  "eip155:84532": {
    tx: (hash) => `https://sepolia.basescan.org/tx/${hash}`,
    address: (addr) => `https://sepolia.basescan.org/address/${addr}`,
  },
  "eip155:5042002": {
    tx: (hash) => `https://testnet.arcscan.app/tx/${hash}`,
    address: (addr) => `https://testnet.arcscan.app/address/${addr}`,
  },
  "solana:devnet": {
    tx: (hash) => `https://explorer.solana.com/tx/${hash}?cluster=devnet`,
    address: (addr) => `https://explorer.solana.com/address/${addr}?cluster=devnet`,
  },
};

/** Default HTLC timelock duration in seconds. */
export const DEFAULT_TIMELOCK_SECONDS = 300;

/** Current atomic data-for-payment protocol version. */
export const PROTOCOL_VERSION = 1;

/** PayproofRegistry contract addresses per network. */
export const REGISTRY_ADDRESSES: Record<string, string> = {
  "eip155:5042002": "0x811A8C492697d3EfbbA754748F34bAF8B59FfCf3", // deployed on Arc
};
