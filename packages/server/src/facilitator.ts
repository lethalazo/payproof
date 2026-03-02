import { createPublicClient, createWalletClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  PublicKey,
  Keypair,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount as getTokenAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { Connection } from "@solana/web3.js";
import {
  HTLC_ABI,
  LockState,
  arcTestnet,
  type PaymentPayload,
  type PaymentRequirements,
  type VerifyResponse,
  type SettleResponse,
  type SupportedResponse,
  type MerchantTransaction,
} from "@payproof/contracts";

import type { PreimageStore } from "./stores/preimage-store.js";
import type { LedgerStore } from "./stores/ledger-store.js";
import { isClientDisconnected } from "./context/request-context.js";

// Inline base58 decode to avoid CJS require issues with bs58 in Next.js bundlers
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
  // Leading zeros
  for (const char of str) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

export interface DirectTransferFacilitatorConfig {
  /** HTLC contract address on Arc EVM. */
  htlcContractAddress: `0x${string}`;
  /** Merchant EVM private key (hex, with or without 0x prefix). */
  merchantEvmPrivateKey: string;
  /** Merchant Solana private key (base58). Optional if Solana not used. */
  merchantSolanaPrivateKey?: string;
  /** Solana HTLC program ID. */
  htlcSolanaProgramId?: string;
  /** Solana USDC mint address. */
  solanaUsdcMint?: string;
  /** Solana RPC URL. Defaults to devnet. */
  solanaRpcUrl?: string;
  /** PreimageStore — defaults to MemoryPreimageStore if not provided. */
  preimageStore: PreimageStore;
  /** LedgerStore — defaults to MemoryLedgerStore if not provided. */
  ledgerStore: LedgerStore;
}

/** Anchor instruction discriminator: first 8 bytes of sha256("global:<name>"). */
async function anchorDiscriminator(name: string): Promise<Buffer> {
  const encoded = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Buffer.from(hash).subarray(0, 8);
}

/**
 * In-process facilitator for the "direct" HTLC scheme.
 *
 * Atomic data-for-payment flow:
 *   1. Client locks funds in on-chain HTLC escrow
 *   2. verify() — reads the lock on-chain, checks recipient/amount/hashlock/timeout
 *   3. postDataHash() — merchant posts SHA-256 of encrypted data on-chain
 *   4. claimAfterConfirmation() — watches for agent's confirmReceipt, then claims with preimage
 */
export class DirectTransferFacilitator {
  private config: DirectTransferFacilitatorConfig;
  private claimedLocks = new Set<string>();
  private arcPublicClient;
  private htlcSolanaProgramId: PublicKey;
  private solanaUsdcMint: PublicKey;
  private solanaConnection: Connection | null = null;

  constructor(config: DirectTransferFacilitatorConfig) {
    this.config = config;
    this.arcPublicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });
    this.htlcSolanaProgramId = new PublicKey(
      config.htlcSolanaProgramId || "HTLC111111111111111111111111111111111111111",
    );
    this.solanaUsdcMint = new PublicKey(
      config.solanaUsdcMint || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    );
  }

  private getSolanaConnection(): Connection {
    if (!this.solanaConnection) {
      const url = this.config.solanaRpcUrl || "https://api.devnet.solana.com";
      this.solanaConnection = new Connection(url, "confirmed");
    }
    return this.solanaConnection;
  }

  private getMerchantWalletClient() {
    const key = this.config.merchantEvmPrivateKey;
    const hex = key.startsWith("0x") ? key : `0x${key}`;
    const account = privateKeyToAccount(hex as `0x${string}`);
    return createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(),
    });
  }

  private getMerchantSolanaKeypair(): Keypair {
    const key = this.config.merchantSolanaPrivateKey;
    if (!key) throw new Error("merchantSolanaPrivateKey not configured — required for Solana HTLC operations");
    return Keypair.fromSecretKey(base58Decode(key));
  }

  async getSupported(): Promise<SupportedResponse> {
    return {
      kinds: [
        { x402Version: 2, scheme: "direct", network: "eip155:5042002" },
        { x402Version: 2, scheme: "direct", network: "solana:devnet" },
      ],
      extensions: [],
      signers: {},
    };
  }

  async verify(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const { network } = paymentRequirements;
    const { payload } = paymentPayload;

    if (!payload.lockId) {
      return { isValid: false, invalidReason: "missing_lock_id" };
    }

    try {
      if (network === "eip155:5042002") {
        return await this.verifyArcHTLC(payload, paymentRequirements);
      } else if (network === "solana:devnet") {
        return await this.verifySolanaHTLC(payload, paymentRequirements);
      }

      return {
        isValid: false,
        invalidReason: "unsupported_network",
        invalidMessage: `Network ${network} not supported`,
      };
    } catch (err) {
      return {
        isValid: false,
        invalidReason: "verification_error",
        invalidMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * settle() is kept for x402 resource server interface compatibility.
   * In the new atomic flow, actual claiming happens via claimAfterConfirmation().
   * This method returns a success stub — the middleware handles the real flow.
   */
  async settle(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const { network } = paymentRequirements;
    const { payload } = paymentPayload;
    const lockId = payload.lockId as string;
    const amountUSDC = formatUnits(BigInt(paymentRequirements.amount), 6);
    const nowTs = Date.now();

    // In the new atomic flow, settle() is a no-op stub.
    // The actual claim happens asynchronously after the agent confirms receipt.
    return {
      success: true,
      payer: "",
      transaction: lockId,
      network,
      chain: network === "solana:devnet" ? "Solana Devnet" : "Arc Testnet",
      amount: amountUSDC,
      symbol: "USDC",
      receiver: paymentRequirements.payTo,
      timestamp: nowTs,
      epoch: Math.floor(nowTs / 1000),
      lockId,
      status: "pending_confirmation",
    };
  }

  // ============================================================
  //  Post Data Hash — merchant commits encrypted data hash on-chain
  // ============================================================

  async postDataHash(lockId: string, dataHash: string, network: string): Promise<string> {
    if (network === "eip155:5042002") {
      return this.postDataHashArc(lockId as `0x${string}`, dataHash as `0x${string}`);
    } else if (network === "solana:devnet") {
      return this.postDataHashSolana(lockId, dataHash);
    }
    throw new Error(`postDataHash: unsupported network ${network}`);
  }

  private async postDataHashArc(lockId: `0x${string}`, dataHash: `0x${string}`): Promise<string> {
    const merchantClient = this.getMerchantWalletClient();
    const txHash = await merchantClient.writeContract({
      address: this.config.htlcContractAddress,
      abi: HTLC_ABI,
      functionName: "postDataHash",
      args: [lockId, dataHash],
    });

    const receipt = await this.arcPublicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`postDataHash tx reverted: ${txHash}`);
    }

    return txHash;
  }

  private async postDataHashSolana(lockIdHex: string, dataHashHex: string): Promise<string> {
    const connection = this.getSolanaConnection();
    const merchantKeypair = this.getMerchantSolanaKeypair();

    const lockIdBytes = Buffer.from(lockIdHex.replace(/^0x/, ""), "hex");
    const dataHashBytes = Buffer.from(dataHashHex.replace(/^0x/, ""), "hex");

    const [lockPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("lock"), lockIdBytes],
      this.htlcSolanaProgramId,
    );

    const disc = await anchorDiscriminator("post_data_hash");
    const ixData = Buffer.alloc(8 + 32);
    disc.copy(ixData, 0);
    dataHashBytes.copy(ixData, 8);

    const ix = new TransactionInstruction({
      programId: this.htlcSolanaProgramId,
      keys: [
        { pubkey: merchantKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
      ],
      data: ixData,
    });

    // Retry up to 3 times with fresh blockhash on expiry
    for (let attempt = 0; attempt < 3; attempt++) {
      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = merchantKeypair.publicKey;
      tx.sign(merchantKeypair);

      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
      });

      try {
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed",
        );
        return signature;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("expired") || msg.includes("block height")) {
          console.warn(`[facilitator] postDataHash Solana attempt ${attempt + 1} expired, retrying...`);
          continue;
        }
        // Check if tx actually succeeded despite confirmation error
        const statuses = await connection.getSignatureStatuses([signature]);
        const status = statuses.value[0];
        if (status?.confirmationStatus && !status.err) {
          return signature;
        }
        throw err;
      }
    }

    throw new Error("postDataHash Solana: all retry attempts expired");
  }

  // ============================================================
  //  Get Lock State — read on-chain state for recovery checks
  // ============================================================

  async getLockState(lockId: string, network: string): Promise<number | undefined> {
    try {
      if (network === "eip155:5042002") {
        const lock = await this.arcPublicClient.readContract({
          address: this.config.htlcContractAddress,
          abi: HTLC_ABI,
          functionName: "getLock",
          args: [lockId as `0x${string}`],
        });
        return (lock as unknown as { state: number }).state;
      } else if (network === "solana:devnet") {
        const connection = this.getSolanaConnection();
        const lockIdBytes = Buffer.from(lockId.replace(/^0x/, ""), "hex");
        const [lockPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("lock"), lockIdBytes],
          this.htlcSolanaProgramId,
        );
        const accountInfo = await connection.getAccountInfo(lockPDA);
        if (!accountInfo || accountInfo.data.length < 153) return undefined;
        return accountInfo.data[152];
      }
    } catch {
      return undefined;
    }
  }

  // ============================================================
  //  Claim After Confirmation — async background claim
  // ============================================================

  /**
   * Fire-and-forget: watches for the agent's confirmReceipt, then claims with preimage.
   * This runs after the HTTP response is sent to the agent.
   */
  async claimAfterConfirmation(
    lockId: string,
    hashlock: string,
    network: string,
    endpoint?: string,
    preimage?: string,
  ): Promise<void> {
    try {
      if (network === "eip155:5042002") {
        await this.claimAfterConfirmationArc(lockId as `0x${string}`, hashlock, endpoint, preimage);
      } else if (network === "solana:devnet") {
        await this.claimAfterConfirmationSolana(lockId, hashlock, endpoint, preimage);
      }
    } catch (err) {
      console.error("[facilitator] claimAfterConfirmation failed:", err instanceof Error ? err.message : err);
    }
  }

  private async claimAfterConfirmationArc(
    lockId: `0x${string}`,
    hashlock: string,
    endpoint?: string,
    passedPreimage?: string,
  ): Promise<void> {
    // Poll for Confirmed state (agent called confirmReceipt)
    const maxWaitMs = 180_000; // 3 minutes
    const pollIntervalMs = 3_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const lock = await this.arcPublicClient.readContract({
        address: this.config.htlcContractAddress,
        abi: HTLC_ABI,
        functionName: "getLock",
        args: [lockId],
      });

      const lockData = lock as unknown as { state: number };

      if (lockData.state === LockState.Confirmed) {
        break;
      }
      if (lockData.state !== LockState.DataPosted) {
        console.warn("[facilitator] Lock state changed unexpectedly:", lockData.state);
        return;
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    // Retrieve preimage and claim
    const preimage = passedPreimage ?? await this.config.preimageStore.getPreimage(hashlock);
    if (!preimage) {
      console.error("[facilitator] No preimage found for hashlock during claim");
      return;
    }

    if (this.claimedLocks.has(lockId)) return;

    const preimageHex = `0x${preimage}` as `0x${string}`;
    const merchantClient = this.getMerchantWalletClient();

    const txHash = await merchantClient.writeContract({
      address: this.config.htlcContractAddress,
      abi: HTLC_ABI,
      functionName: "claim",
      args: [lockId, preimageHex],
    });

    const receipt = await this.arcPublicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      console.error("[facilitator] Claim tx reverted:", txHash);
      return;
    }

    this.claimedLocks.add(lockId);

    const amountRaw = await this.arcPublicClient.readContract({
      address: this.config.htlcContractAddress,
      abi: HTLC_ABI,
      functionName: "getLock",
      args: [lockId],
    });
    const amount = (amountRaw as unknown as { amount: bigint }).amount;
    const amountUSDC = formatUnits(amount, 6);

    const tx: MerchantTransaction = {
      id: lockId,
      timestamp: Date.now(),
      network: "eip155:5042002",
      chain: "Arc Testnet",
      txHash,
      amount: amountUSDC,
      payer: receipt.from,
      endpoint,
      type: "htlc-claim",
    };
    await this.config.ledgerStore.record(tx);
    console.log("[facilitator] Arc claim successful:", txHash);
  }

  private async claimAfterConfirmationSolana(
    lockIdHex: string,
    hashlock: string,
    endpoint?: string,
    passedPreimage?: string,
  ): Promise<void> {
    const connection = this.getSolanaConnection();
    const merchantKeypair = this.getMerchantSolanaKeypair();
    const lockIdBytes = Buffer.from(lockIdHex.replace(/^0x/, ""), "hex");

    const [lockPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("lock"), lockIdBytes],
      this.htlcSolanaProgramId,
    );
    const [escrowPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), lockIdBytes],
      this.htlcSolanaProgramId,
    );

    // Poll for Confirmed state
    const maxWaitMs = 180_000;
    const pollIntervalMs = 3_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const accountInfo = await connection.getAccountInfo(lockPDA);
      if (!accountInfo || accountInfo.data.length < 258) {
        console.warn("[facilitator] Solana lock account missing or too short");
        return;
      }

      // State is at offset 8+32+32+32+8+32+8 = 152 (after discriminator)
      const state = accountInfo.data[8 + 32 + 32 + 32 + 8 + 32 + 8];
      if (state === 3) break; // Confirmed
      if (state !== 2) { // Not DataPosted
        console.warn("[facilitator] Solana lock state changed unexpectedly:", state);
        return;
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    const preimage = passedPreimage ?? await this.config.preimageStore.getPreimage(hashlock);
    if (!preimage) {
      console.error("[facilitator] No preimage found for Solana claim");
      return;
    }

    if (this.claimedLocks.has(lockIdHex)) return;

    const preimageBytes = Buffer.from(preimage, "hex");

    const lockAccountInfo = (await connection.getAccountInfo(lockPDA))!;
    const recipientPubkey = new PublicKey(
      lockAccountInfo.data.subarray(8 + 32, 8 + 32 + 32),
    );
    // Amount is at offset 8+32+32+32 = 104 (u64 LE)
    const lockAmount = lockAccountInfo.data.readBigUInt64LE(104);
    const recipientAta = await getAssociatedTokenAddress(this.solanaUsdcMint, recipientPubkey);

    // Build claim instruction
    const disc = await anchorDiscriminator("claim");
    const claimData = Buffer.alloc(8 + 32);
    disc.copy(claimData, 0);
    preimageBytes.copy(claimData, 8);

    const claimIx = new TransactionInstruction({
      programId: this.htlcSolanaProgramId,
      keys: [
        { pubkey: merchantKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: recipientAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: claimData,
    });

    // Retry up to 3 times with fresh blockhash
    let claimSignature: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const tx = new Transaction();
      try {
        await getTokenAccount(connection, recipientAta);
      } catch {
        tx.add(
          createAssociatedTokenAccountInstruction(
            merchantKeypair.publicKey,
            recipientAta,
            recipientPubkey,
            this.solanaUsdcMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }
      tx.add(claimIx);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = merchantKeypair.publicKey;
      tx.sign(merchantKeypair);

      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
      });

      try {
        const confirmation = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed",
        );
        if (confirmation.value.err) {
          console.error("[facilitator] Solana claim failed:", confirmation.value.err);
          return;
        }
        claimSignature = signature;
        break;
      } catch (confirmErr) {
        const msg = confirmErr instanceof Error ? confirmErr.message : String(confirmErr);
        if (msg.includes("expired") || msg.includes("block height")) {
          console.warn(`[facilitator] Solana claim attempt ${attempt + 1} expired, retrying...`);
          continue;
        }
        // Check if tx actually succeeded
        const statuses = await connection.getSignatureStatuses([signature]);
        const status = statuses.value[0];
        if (status?.confirmationStatus && !status.err) {
          claimSignature = signature;
          break;
        }
        console.error("[facilitator] Solana claim confirmation failed:", confirmErr);
        return;
      }
    }

    if (!claimSignature) {
      console.error("[facilitator] Solana claim: all retry attempts expired");
      return;
    }
    const signature = claimSignature;

    this.claimedLocks.add(lockIdHex);

    const txRecord: MerchantTransaction = {
      id: lockIdHex,
      timestamp: Date.now(),
      network: "solana:devnet",
      chain: "Solana Devnet",
      txHash: signature,
      amount: formatUnits(lockAmount, 6),
      endpoint,
      type: "htlc-claim",
    };
    await this.config.ledgerStore.record(txRecord);
    console.log("[facilitator] Solana claim successful:", signature);
  }

  // ============================================================
  //  Arc (EVM) HTLC Verification
  // ============================================================

  private async verifyArcHTLC(
    payload: Record<string, unknown>,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const lockId = payload.lockId as `0x${string}`;

    const lock = await this.arcPublicClient.readContract({
      address: this.config.htlcContractAddress,
      abi: HTLC_ABI,
      functionName: "getLock",
      args: [lockId],
    });

    const lockData = lock as unknown as {
      sender: string; recipient: string; token: string;
      amount: bigint; hashlock: string; timelock: bigint;
      dataDeadline: bigint; dataHash: string; receiptHash: string;
      state: number;
    };
    const { sender, recipient, amount, hashlock: lockHashlock, timelock, state } = lockData;

    if (state !== LockState.Locked) {
      return {
        isValid: false,
        invalidReason: "not_locked",
        invalidMessage: `Lock state is ${state}, expected Locked (1)`,
      };
    }

    if (recipient.toLowerCase() !== requirements.payTo.toLowerCase()) {
      return {
        isValid: false,
        invalidReason: "wrong_recipient",
        invalidMessage: `Lock recipient ${recipient}, expected ${requirements.payTo}`,
      };
    }

    if (amount < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "insufficient_amount",
        invalidMessage: `Lock amount ${amount} < required ${requirements.amount}`,
      };
    }

    const expectedHashlock = requirements.extra?.hashlock as string;
    if (expectedHashlock && lockHashlock.toLowerCase() !== expectedHashlock.toLowerCase()) {
      return {
        isValid: false,
        invalidReason: "wrong_hashlock",
        invalidMessage: "Lock hashlock does not match expected",
      };
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (timelock <= now) {
      return {
        isValid: false,
        invalidReason: "expired",
        invalidMessage: "Lock timelock has already expired",
      };
    }

    return { isValid: true, payer: sender };
  }

  // ============================================================
  //  Solana HTLC Verification
  // ============================================================

  private async verifySolanaHTLC(
    payload: Record<string, unknown>,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const lockPDAStr = payload.lockPDA as string;

    if (!lockPDAStr) {
      return { isValid: false, invalidReason: "missing_lock_pda" };
    }

    const connection = this.getSolanaConnection();
    const lockPDA = new PublicKey(lockPDAStr);

    const accountInfo = await connection.getAccountInfo(lockPDA);
    if (!accountInfo) {
      return {
        isValid: false,
        invalidReason: "lock_not_found",
        invalidMessage: "Lock PDA account does not exist on-chain",
      };
    }

    const data = accountInfo.data;
    if (data.length < 258) {
      return {
        isValid: false,
        invalidReason: "invalid_account_data",
        invalidMessage: "Lock account data too short (expected 258 bytes for new program)",
      };
    }

    let offset = 8;
    const sender = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
    const recipient = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
    offset += 32; // mint
    const amount = data.readBigUInt64LE(offset); offset += 8;
    const hashlock = data.subarray(offset, offset + 32); offset += 32;
    const timelock = data.readBigInt64LE(offset); offset += 8;
    const state = data[offset];

    if (state !== 1) {
      return {
        isValid: false,
        invalidReason: "not_locked",
        invalidMessage: `Lock state is ${state}, expected 1 (Locked)`,
      };
    }

    const expectedRecipient = new PublicKey(requirements.payTo);
    if (!recipient.equals(expectedRecipient)) {
      return {
        isValid: false,
        invalidReason: "wrong_recipient",
        invalidMessage: `Lock recipient ${recipient.toBase58()}, expected ${requirements.payTo}`,
      };
    }

    if (amount < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "insufficient_amount",
        invalidMessage: `Lock amount ${amount} < required ${requirements.amount}`,
      };
    }

    const expectedHashlock = requirements.extra?.hashlock as string;
    if (expectedHashlock) {
      const expectedHex = expectedHashlock.startsWith("0x")
        ? expectedHashlock.slice(2)
        : expectedHashlock;
      const expectedBuf = Buffer.from(expectedHex, "hex");
      if (!hashlock.equals(expectedBuf)) {
        return {
          isValid: false,
          invalidReason: "wrong_hashlock",
          invalidMessage: "Lock hashlock does not match expected",
        };
      }
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (timelock <= now) {
      return {
        isValid: false,
        invalidReason: "expired",
        invalidMessage: "Lock timelock has already expired",
      };
    }

    return { isValid: true, payer: sender.toBase58() };
  }
}
