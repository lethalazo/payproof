/** Canonical x402 protocol types for the Payproof HTLC payment system. */

export type Network = `${string}:${string}`;

export interface PaymentPayload {
  x402Version: number;
  resource: { url: string; description: string; mimeType: string };
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export interface PaymentRequirements {
  scheme: string;
  network: Network;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: string;
}

export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  errorMessage?: string;
  payer?: string;
  transaction: string;
  network: Network;
  chain?: string;
  amount?: string;
  symbol?: string;
  receiver?: string;
  sender?: string;
  timestamp?: number;
  epoch?: number;
  explorerUrl?: string;
  lockId?: string;
  endpoint?: string;
  status?: string;
}

export interface SupportedResponse {
  kinds: {
    x402Version: number;
    scheme: string;
    network: Network;
    extra?: Record<string, unknown>;
  }[];
  extensions: string[];
  signers: Record<string, string[]>;
}

export interface PaymentPayloadResult {
  x402Version: number;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export type Price = string | number | AssetAmount;

export interface AssetAmount {
  asset: string;
  amount: string;
  extra?: Record<string, unknown>;
}

export interface EncryptedPayload {
  encryptedBlob: string;  // base64
  nonce: string;          // hex (12 bytes = 24 hex chars)
  authTag: string;        // hex (16 bytes = 32 hex chars)
  dataHash: string;       // 0x-prefixed SHA-256 of encrypted blob bytes
}

export interface PendingLock {
  lockId: string;
  network: string;
  amount: string;
  timelock: number;
  createdAt: number;
  status: "locked" | "settled" | "refunded" | "claimed_by_server";
  lockPDA?: string;
  escrowPDA?: string;
  encryptedPayload?: EncryptedPayload;
}

export interface MerchantTransaction {
  id: string;
  timestamp: number;
  network: string;
  chain: string;
  txHash: string;
  amount: string;
  payer?: string;
  endpoint?: string;
  type: "htlc-claim" | "x402-exact";
}
