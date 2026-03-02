import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  PublicKey,
  Keypair,
  Connection,
} from "@solana/web3.js";
import { HTLC_ABI, REGISTRY_ABI, arcTestnet } from "@payproof/contracts";

// ============================================================
//  Base58 decode (inline to avoid CJS/ESM issues)
// ============================================================

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Decode(str: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 character: ${char}`);
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

// ============================================================
//  EVM Accounts & Clients
// ============================================================

export function getAgentAccount() {
  const key = process.env.AGENT_PRIVATE_KEY!;
  const hex = key.startsWith("0x") ? key : `0x${key}`;
  return privateKeyToAccount(hex as `0x${string}`);
}

export function getMerchantAccount() {
  const key = process.env.MERCHANT_PRIVATE_KEY!;
  const hex = key.startsWith("0x") ? key : `0x${key}`;
  return privateKeyToAccount(hex as `0x${string}`);
}

export function getArcPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });
}

export function getAgentArcWalletClient() {
  return createWalletClient({
    account: getAgentAccount(),
    chain: arcTestnet,
    transport: http(),
  });
}

export function getMerchantArcWalletClient() {
  return createWalletClient({
    account: getMerchantAccount(),
    chain: arcTestnet,
    transport: http(),
  });
}

// ============================================================
//  Contract Addresses
// ============================================================

export function HTLC_ADDRESS(): `0x${string}` {
  return process.env.HTLC_CONTRACT_ADDRESS as `0x${string}`;
}

export function REGISTRY_ADDRESS(): `0x${string}` {
  return (process.env.PAYPROOF_REGISTRY_ADDRESS || "0x811A8C492697d3EfbbA754748F34bAF8B59FfCf3") as `0x${string}`;
}

export function MERCHANT_ADDRESS(): `0x${string}` {
  return process.env.MERCHANT_ADDRESS as `0x${string}`;
}

export const USDC_ARC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;

// ============================================================
//  EVM Lock Reader
// ============================================================

export async function readArcLock(lockId: `0x${string}`) {
  const client = getArcPublicClient();
  const lock = await client.readContract({
    address: HTLC_ADDRESS(),
    abi: HTLC_ABI,
    functionName: "getLock",
    args: [lockId],
  });
  const data = lock as unknown as {
    sender: string;
    recipient: string;
    token: string;
    amount: bigint;
    hashlock: string;
    timelock: bigint;
    dataDeadline: bigint;
    dataHash: string;
    receiptHash: string;
    state: number;
  };
  return data;
}

export async function waitForArcTx(hash: `0x${string}`) {
  const client = getArcPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }
  return receipt;
}

// ============================================================
//  Solana Accounts & Connection
// ============================================================

export function getAgentSolanaKeypair(): Keypair {
  const key = process.env.AGENT_SOLANA_PRIVATE_KEY!;
  return Keypair.fromSecretKey(base58Decode(key));
}

export function getMerchantSolanaKeypair(): Keypair {
  const key = process.env.MERCHANT_SOLANA_PRIVATE_KEY!;
  return Keypair.fromSecretKey(base58Decode(key));
}

export function getSolanaConnection(): Connection {
  const url = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  return new Connection(url, "confirmed");
}

export function getSolanaProgramId(): PublicKey {
  return new PublicKey(process.env.HTLC_SOLANA_PROGRAM_ID!);
}

export const SOLANA_USDC_MINT = new PublicKey(
  process.env.SOLANA_USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

// ============================================================
//  Solana PDA Derivation
// ============================================================

export function deriveLockPDA(lockId: Buffer, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lock"), lockId],
    programId,
  );
}

export function deriveEscrowPDA(lockId: Buffer, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), lockId],
    programId,
  );
}

// ============================================================
//  Solana Lock Reader
// ============================================================

export async function readSolanaLock(lockPDA: PublicKey, connection: Connection) {
  const accountInfo = await connection.getAccountInfo(lockPDA);
  if (!accountInfo) throw new Error("Lock account not found");

  const data = accountInfo.data;
  if (data.length < 258) {
    throw new Error(`Lock account data too short: ${data.length} bytes (expected >= 258)`);
  }

  let offset = 8; // skip discriminator
  const sender = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const recipient = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const mint = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const amount = data.readBigUInt64LE(offset); offset += 8;
  const hashlock = Buffer.from(data.subarray(offset, offset + 32)); offset += 32;
  const timelock = data.readBigInt64LE(offset); offset += 8;
  const state = data[offset]; offset += 1;
  const lockId = Buffer.from(data.subarray(offset, offset + 32)); offset += 32;
  const bump = data[offset]; offset += 1;
  const dataDeadline = data.readBigInt64LE(offset); offset += 8;
  const dataHash = Buffer.from(data.subarray(offset, offset + 32)); offset += 32;
  const receiptHash = Buffer.from(data.subarray(offset, offset + 32)); offset += 32;

  return {
    sender, recipient, mint, amount, hashlock, timelock,
    state, lockId, bump, dataDeadline, dataHash, receiptHash,
  };
}

// ============================================================
//  Anchor Discriminator
// ============================================================

export async function anchorDiscriminator(name: string): Promise<Buffer> {
  const encoded = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Buffer.from(hash).subarray(0, 8);
}

// ============================================================
//  Utilities
// ============================================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
