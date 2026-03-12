export type AgentEventType =
  | "text"
  | "tool_call"
  | "tool_result"
  | "error"
  | "done";

export interface AgentEvent {
  type: AgentEventType;
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  timestamp: number;
}

export interface TransactionRecord {
  id: string;
  chain: "base-sepolia" | "arc-testnet";
  type: "x402-payment" | "x402-direct" | "transfer";
  amount: string;
  description: string;
  timestamp: number;
  txHash?: string;
}

export interface WalletInfo {
  chain: string;
  address: string;
  balance: string;
  symbol: string;
}
