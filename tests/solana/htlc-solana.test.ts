import { describe, it, expect } from "vitest";
import { randomBytes, createHash } from "crypto";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  getAgentSolanaKeypair,
  getMerchantSolanaKeypair,
  getSolanaConnection,
  getSolanaProgramId,
  SOLANA_USDC_MINT,
  deriveLockPDA,
  deriveEscrowPDA,
  readSolanaLock,
  anchorDiscriminator,
  sleep,
} from "../helpers.js";

async function sendSolanaTx(
  connection: ReturnType<typeof getSolanaConnection>,
  ixs: TransactionInstruction[],
  signers: ReturnType<typeof getAgentSolanaKeypair>[],
) {
  const tx = new Transaction();
  for (const ix of ixs) tx.add(ix);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = signers[0].publicKey;
  tx.sign(...signers);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return signature;
}

function generatePreimage(): { preimageBytes: Buffer; hashlockBytes: Buffer } {
  const preimageBytes = randomBytes(32);
  const hashlockBytes = createHash("sha256").update(preimageBytes).digest();
  return { preimageBytes: Buffer.from(preimageBytes), hashlockBytes: Buffer.from(hashlockBytes) };
}

describe("Solana HTLC on-chain (7-state)", () => {
  const connection = getSolanaConnection();
  const programId = getSolanaProgramId();
  const agentKeypair = getAgentSolanaKeypair();
  const merchantKeypair = getMerchantSolanaKeypair();

  async function lockFunds(
    lockIdBytes: Buffer,
    hashlockBytes: Buffer,
    amount: bigint,
    timelockSeconds: number,
  ) {
    const [lockPDA] = deriveLockPDA(lockIdBytes, programId);
    const [escrowPDA] = deriveEscrowPDA(lockIdBytes, programId);
    const senderAta = await getAssociatedTokenAddress(SOLANA_USDC_MINT, agentKeypair.publicKey);
    const timelock = BigInt(Math.floor(Date.now() / 1000) + timelockSeconds);

    const disc = await anchorDiscriminator("lock");
    const data = Buffer.alloc(8 + 32 + 32 + 8 + 8);
    disc.copy(data, 0);
    lockIdBytes.copy(data, 8);
    hashlockBytes.copy(data, 40);
    data.writeBigUInt64LE(amount, 72);
    data.writeBigInt64LE(timelock, 80);

    const ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: merchantKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: SOLANA_USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    });

    const sig = await sendSolanaTx(connection, [ix], [agentKeypair]);
    return { sig, lockPDA, escrowPDA };
  }

  it("lock: agent locks USDC", async () => {
    const lockIdBytes = randomBytes(32);
    const { hashlockBytes } = generatePreimage();

    const { lockPDA } = await lockFunds(
      Buffer.from(lockIdBytes),
      hashlockBytes,
      1000n,
      300,
    );

    const lock = await readSolanaLock(lockPDA, connection);
    expect(lock.state).toBe(1); // Locked
    expect(lock.amount).toBe(1000n);
    expect(lock.sender.equals(agentKeypair.publicKey)).toBe(true);
    expect(lock.recipient.equals(merchantKeypair.publicKey)).toBe(true);
  }, 60_000);

  it("read account: verifies all fields including new 7-state fields", async () => {
    const lockIdBytes = Buffer.from(randomBytes(32));
    const { hashlockBytes } = generatePreimage();

    const { lockPDA } = await lockFunds(lockIdBytes, hashlockBytes, 2000n, 300);

    const lock = await readSolanaLock(lockPDA, connection);
    expect(lock.state).toBe(1);
    expect(lock.dataDeadline).toBe(0n);
    expect(lock.dataHash).toEqual(Buffer.alloc(32)); // zeroed
    expect(lock.receiptHash).toEqual(Buffer.alloc(32)); // zeroed
    expect(Buffer.from(lock.hashlock).equals(hashlockBytes)).toBe(true);
  }, 60_000);

  it("postDataHash: merchant posts hash, state → DataPosted", async () => {
    const lockIdBytes = Buffer.from(randomBytes(32));
    const { hashlockBytes } = generatePreimage();

    const { lockPDA } = await lockFunds(lockIdBytes, hashlockBytes, 1000n, 300);

    // Merchant posts data hash
    const dataHashBytes = randomBytes(32);
    const disc = await anchorDiscriminator("post_data_hash");
    const data = Buffer.alloc(8 + 32);
    disc.copy(data, 0);
    Buffer.from(dataHashBytes).copy(data, 8);

    const ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: merchantKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
      ],
      data,
    });

    await sendSolanaTx(connection, [ix], [merchantKeypair]);

    const lock = await readSolanaLock(lockPDA, connection);
    expect(lock.state).toBe(2); // DataPosted
    expect(lock.dataDeadline).toBeGreaterThan(0n);
    expect(Buffer.from(lock.dataHash).equals(Buffer.from(dataHashBytes))).toBe(true);
  }, 90_000);

  it("confirmReceipt: agent confirms, state → Confirmed", async () => {
    const lockIdBytes = Buffer.from(randomBytes(32));
    const { hashlockBytes } = generatePreimage();

    const { lockPDA } = await lockFunds(lockIdBytes, hashlockBytes, 1000n, 300);

    // Merchant posts data hash
    const dataHashBytes = randomBytes(32);
    let disc = await anchorDiscriminator("post_data_hash");
    let data = Buffer.alloc(8 + 32);
    disc.copy(data, 0);
    Buffer.from(dataHashBytes).copy(data, 8);

    let ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: merchantKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
      ],
      data,
    });
    await sendSolanaTx(connection, [ix], [merchantKeypair]);

    // Agent confirms receipt (same hash as dataHash)
    disc = await anchorDiscriminator("confirm_receipt");
    data = Buffer.alloc(8 + 32);
    disc.copy(data, 0);
    Buffer.from(dataHashBytes).copy(data, 8);

    ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
      ],
      data,
    });
    await sendSolanaTx(connection, [ix], [agentKeypair]);

    const lock = await readSolanaLock(lockPDA, connection);
    expect(lock.state).toBe(3); // Confirmed
    expect(Buffer.from(lock.receiptHash).equals(Buffer.from(dataHashBytes))).toBe(true);
  }, 90_000);

  it("claim: merchant claims with preimage after confirmation, state → Claimed", async () => {
    const lockIdBytes = Buffer.from(randomBytes(32));
    const { preimageBytes, hashlockBytes } = generatePreimage();

    const { lockPDA, escrowPDA } = await lockFunds(lockIdBytes, hashlockBytes, 1000n, 300);

    // postDataHash
    const dataHashBytes = randomBytes(32);
    let disc = await anchorDiscriminator("post_data_hash");
    let data = Buffer.alloc(8 + 32);
    disc.copy(data, 0);
    Buffer.from(dataHashBytes).copy(data, 8);

    let ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: merchantKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
      ],
      data,
    });
    await sendSolanaTx(connection, [ix], [merchantKeypair]);

    // confirmReceipt
    disc = await anchorDiscriminator("confirm_receipt");
    data = Buffer.alloc(8 + 32);
    disc.copy(data, 0);
    Buffer.from(dataHashBytes).copy(data, 8);

    ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
      ],
      data,
    });
    await sendSolanaTx(connection, [ix], [agentKeypair]);

    // claim
    const recipientAta = await getAssociatedTokenAddress(SOLANA_USDC_MINT, merchantKeypair.publicKey);
    disc = await anchorDiscriminator("claim");
    data = Buffer.alloc(8 + 32);
    disc.copy(data, 0);
    preimageBytes.copy(data, 8);

    ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: merchantKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: recipientAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    await sendSolanaTx(connection, [ix], [merchantKeypair]);

    const lock = await readSolanaLock(lockPDA, connection);
    expect(lock.state).toBe(4); // Claimed
  }, 90_000);

  it("refund: agent refunds after timelock expires, state → Refunded", async () => {
    const lockIdBytes = Buffer.from(randomBytes(32));
    const { hashlockBytes } = generatePreimage();

    const { lockPDA, escrowPDA } = await lockFunds(
      lockIdBytes,
      hashlockBytes,
      1000n,
      2, // 2-second timelock
    );

    await sleep(5000);

    const senderAta = await getAssociatedTokenAddress(SOLANA_USDC_MINT, agentKeypair.publicKey);
    const disc = await anchorDiscriminator("refund");

    const ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: disc,
    });
    await sendSolanaTx(connection, [ix], [agentKeypair]);

    const lock = await readSolanaLock(lockPDA, connection);
    expect(lock.state).toBe(5); // Refunded
  }, 60_000);

  it("sendToTreasury: funds sent to treasury after dataDeadline, state → Treasury", async () => {
    const lockIdBytes = Buffer.from(randomBytes(32));
    const { hashlockBytes } = generatePreimage();

    // Lock with short timelock - but we need postDataHash first, so use longer timelock
    const { lockPDA, escrowPDA } = await lockFunds(lockIdBytes, hashlockBytes, 1000n, 300);

    // postDataHash
    const dataHashBytes = randomBytes(32);
    let disc = await anchorDiscriminator("post_data_hash");
    let data = Buffer.alloc(8 + 32);
    disc.copy(data, 0);
    Buffer.from(dataHashBytes).copy(data, 8);

    let ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: merchantKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
      ],
      data,
    });
    await sendSolanaTx(connection, [ix], [merchantKeypair]);

    // Wait for confirmation window to expire (120s + buffer)
    // NOTE: This test takes ~130s due to the CONFIRMATION_WINDOW constant
    const lock = await readSolanaLock(lockPDA, connection);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const waitSeconds = Number(lock.dataDeadline - now) + 5;
    if (waitSeconds > 0) {
      await sleep(waitSeconds * 1000);
    }

    // sendToTreasury requires config PDA and treasury ATA
    const [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      programId,
    );

    // Read config to get treasury address
    const configInfo = await connection.getAccountInfo(configPDA);
    if (!configInfo) {
      // Config not initialized - skip this test
      console.warn("ProgramConfig not initialized; skipping sendToTreasury test");
      return;
    }

    const treasuryPubkey = new PublicKey(configInfo.data.subarray(8 + 32, 8 + 32 + 32));
    const treasuryAta = await getAssociatedTokenAddress(SOLANA_USDC_MINT, treasuryPubkey);

    disc = await anchorDiscriminator("send_to_treasury");

    ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: configPDA, isSigner: false, isWritable: false },
        { pubkey: lockPDA, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: treasuryAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: disc,
    });
    await sendSolanaTx(connection, [ix], [agentKeypair]);

    const updatedLock = await readSolanaLock(lockPDA, connection);
    expect(updatedLock.state).toBe(6); // Treasury
  }, 180_000);
});
