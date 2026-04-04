import { randomBytes, createHash } from "crypto";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  Transaction,
  type Connection,
  type Keypair,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

function anchorDiscriminator(name: string): Buffer {
  return createHash("sha256")
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8);
}

export interface HtlcSolanaClientConfig {
  programId: string;
  keypair: Keypair;
  connection: Connection;
  usdcMint: PublicKey;
}

/** Derive the lock PDA for a given lock_id. */
export function deriveLockPDA(lockId: Buffer, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lock"), lockId],
    programId,
  );
}

/** Derive the escrow token account PDA for a given lock_id. */
export function deriveEscrowPDA(lockId: Buffer, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), lockId],
    programId,
  );
}

/** Generate a random 32-byte lock ID for Solana. */
export function generateSolanaLockId(): Buffer {
  return randomBytes(32);
}

export function createHtlcSolanaClient(config: HtlcSolanaClientConfig) {
  const programId = new PublicKey(config.programId);
  const { keypair, connection, usdcMint } = config;

  async function lockFundsSolana(params: {
    lockId: Buffer;
    recipient: PublicKey;
    amount: bigint;
    hashlock: Buffer;
    timelockSeconds: number;
  }): Promise<{ signature: string; lockPDA: PublicKey; escrowPDA: PublicKey }> {
    const [lockPDA] = deriveLockPDA(params.lockId, programId);
    const [escrowPDA] = deriveEscrowPDA(params.lockId, programId);

    const senderAta = await getAssociatedTokenAddress(usdcMint, keypair.publicKey);

    const timelock = BigInt(Math.floor(Date.now() / 1000) + params.timelockSeconds);

    const disc = anchorDiscriminator("lock");
    const data = Buffer.alloc(8 + 32 + 32 + 8 + 8);
    disc.copy(data, 0);
    params.lockId.copy(data, 8);
    params.hashlock.copy(data, 40);
    data.writeBigUInt64LE(BigInt(params.amount), 72);
    data.writeBigInt64LE(timelock, 80);

    const ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: params.recipient, isSigner: false, isWritable: false },
        { pubkey: usdcMint, isSigner: false, isWritable: false },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = keypair.publicKey;
      tx.sign(keypair);

      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
      });

      try {
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed",
        );
        return { signature, lockPDA, escrowPDA };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if ((msg.includes("expired") || msg.includes("block height")) && attempt < 2) continue;
        const statuses = await connection.getSignatureStatuses([signature]);
        if (statuses.value[0]?.confirmationStatus && !statuses.value[0]?.err) {
          return { signature, lockPDA, escrowPDA };
        }
        throw err;
      }
    }

    throw new Error("lockFundsSolana: all retry attempts expired");
  }

  async function refundLockSolana(lockId: Buffer): Promise<string> {
    const [lockPDA] = deriveLockPDA(lockId, programId);
    const [escrowPDA] = deriveEscrowPDA(lockId, programId);

    const senderAta = await getAssociatedTokenAddress(usdcMint, keypair.publicKey);

    const disc = anchorDiscriminator("refund");

    const ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: disc,
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = keypair.publicKey;
      tx.sign(keypair);

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
        if ((msg.includes("expired") || msg.includes("block height")) && attempt < 2) continue;
        const statuses = await connection.getSignatureStatuses([signature]);
        if (statuses.value[0]?.confirmationStatus && !statuses.value[0]?.err) {
          return signature;
        }
        throw err;
      }
    }

    throw new Error("refundLockSolana: all retry attempts expired");
  }

  /**
   * Confirm receipt of encrypted data on-chain.
   * Sends confirm_receipt instruction to the Solana HTLC program.
   */
  async function confirmReceiptSolana(params: {
    lockId: Buffer;
    receiptHash: Buffer;
  }): Promise<string> {
    const [lockPDA] = deriveLockPDA(params.lockId, programId);

    const disc = anchorDiscriminator("confirm_receipt");
    const data = Buffer.alloc(8 + 32);
    disc.copy(data, 0);
    params.receiptHash.copy(data, 8);

    const ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
      ],
      data,
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = keypair.publicKey;
      tx.sign(keypair);

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
        if ((msg.includes("expired") || msg.includes("block height")) && attempt < 2) continue;
        const statuses = await connection.getSignatureStatuses([signature]);
        if (statuses.value[0]?.confirmationStatus && !statuses.value[0]?.err) {
          return signature;
        }
        throw err;
      }
    }

    throw new Error("confirmReceiptSolana: all retry attempts expired");
  }

  /**
   * Watch for the merchant's claim transaction and extract the preimage.
   * Polls the lock account state. When Claimed (state=4), reads the preimage
   * from transaction logs. Returns preimage as hex string (no 0x prefix).
   */
  async function watchForClaimSolana(params: {
    lockId: Buffer;
    timeoutMs?: number;
  }): Promise<string> {
    const timeoutMs = params.timeoutMs ?? 60_000;
    const pollIntervalMs = 2_000;
    const startTime = Date.now();

    const [lockPDA] = deriveLockPDA(params.lockId, programId);

    while (Date.now() - startTime < timeoutMs) {
      const accountInfo = await connection.getAccountInfo(lockPDA);
      if (!accountInfo || accountInfo.data.length < 258) {
        throw new Error("Lock account missing or invalid");
      }

      // State is at offset: 8 (disc) + 32 + 32 + 32 + 8 + 32 + 8 = 152
      const state = accountInfo.data[152];

      if (state === 4) { // Claimed
        // Read recent transaction signatures for the lock PDA to find the claim tx
        const signatures = await connection.getSignaturesForAddress(lockPDA, { limit: 10 });

        for (const sigInfo of signatures) {
          const txDetail = await connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          });
          if (!txDetail?.meta?.logMessages) continue;

          // Look for the ClaimedEvent in logs - Anchor emits it as base64 data
          // The preimage is the 32 bytes in the claim instruction data after the 8-byte discriminator
          // Extract preimage from instruction data
          const message = txDetail.transaction.message;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const instructions = (message as any).compiledInstructions || (message as any).instructions;
          if (!instructions) continue;

          const claimDisc = anchorDiscriminator("claim");
          for (const ix of instructions) {
            const ixData = Buffer.from(ix.data);
            // Claim instruction: 8 bytes discriminator + 32 bytes preimage = 40 bytes
            // Verify discriminator to distinguish from post_data_hash and confirm_receipt (also 40 bytes)
            if (ixData.length === 40 && ixData.subarray(0, 8).equals(claimDisc)) {
              const preimage = ixData.subarray(8, 40);
              return preimage.toString("hex");
            }
          }
        }

        throw new Error("Lock is Claimed but could not extract preimage from tx logs");
      }

      if (state !== 3 && state !== 2) { // Not Confirmed or DataPosted
        throw new Error(`Unexpected lock state ${state} while waiting for claim`);
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new Error(`Timed out waiting for Solana claim after ${timeoutMs}ms`);
  }

  return {
    lockFundsSolana,
    refundLockSolana,
    confirmReceiptSolana,
    watchForClaimSolana,
    deriveLockPDA: (lockId: Buffer) => deriveLockPDA(lockId, programId),
    deriveEscrowPDA: (lockId: Buffer) => deriveEscrowPDA(lockId, programId),
  };
}
