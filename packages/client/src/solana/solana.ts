import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount as getSplAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sendAndConfirmTransaction } from "@solana/web3.js";

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
  for (const char of str) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

export interface SolanaWalletConfig {
  privateKey: string; // base58
  usdcMint?: string;
  rpcUrl?: string;
}

export interface SolanaWallet {
  keypair: Keypair;
  connection: Connection;
  usdcMint: PublicKey;
  getAddress(): string;
  getUSDCBalance(): Promise<string>;
  transferUSDC(to: string, amount: string): Promise<string>;
  signUSDCTransfer(to: string, amount: string): Promise<string>;
}

const USDC_DECIMALS = 6;

export function createSolanaWallet(config: SolanaWalletConfig): SolanaWallet {
  const keypair = Keypair.fromSecretKey(base58Decode(config.privateKey));
  const connection = new Connection(
    config.rpcUrl || clusterApiUrl("devnet"),
    "confirmed",
  );
  const usdcMint = new PublicKey(
    config.usdcMint || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  );

  function getAddress(): string {
    return keypair.publicKey.toBase58();
  }

  async function getUSDCBalance(): Promise<string> {
    const ata = await getAssociatedTokenAddress(usdcMint, keypair.publicKey);
    try {
      const account = await getSplAccount(connection, ata);
      const balance = Number(account.amount) / 10 ** USDC_DECIMALS;
      return balance.toFixed(USDC_DECIMALS);
    } catch {
      return "0.000000";
    }
  }

  async function transferUSDC(to: string, amount: string): Promise<string> {
    const recipient = new PublicKey(to);
    const amountLamports = BigInt(
      Math.round(parseFloat(amount) * 10 ** USDC_DECIMALS),
    );

    const senderAta = await getAssociatedTokenAddress(usdcMint, keypair.publicKey);
    const recipientAta = await getAssociatedTokenAddress(usdcMint, recipient);

    const tx = new Transaction();
    try {
      await getSplAccount(connection, recipientAta);
    } catch {
      tx.add(
        createAssociatedTokenAccountInstruction(
          keypair.publicKey,
          recipientAta,
          recipient,
          usdcMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    tx.add(
      createTransferInstruction(
        senderAta,
        recipientAta,
        keypair.publicKey,
        amountLamports,
      ),
    );

    return sendAndConfirmTransaction(connection, tx, [keypair]);
  }

  async function signUSDCTransfer(to: string, amount: string): Promise<string> {
    const recipient = new PublicKey(to);
    const amountLamports = BigInt(
      Math.round(parseFloat(amount) * 10 ** USDC_DECIMALS),
    );

    const senderAta = await getAssociatedTokenAddress(usdcMint, keypair.publicKey);
    const recipientAta = await getAssociatedTokenAddress(usdcMint, recipient);

    const tx = new Transaction();
    try {
      await getSplAccount(connection, recipientAta);
    } catch {
      tx.add(
        createAssociatedTokenAccountInstruction(
          keypair.publicKey,
          recipientAta,
          recipient,
          usdcMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    tx.add(
      createTransferInstruction(
        senderAta,
        recipientAta,
        keypair.publicKey,
        amountLamports,
      ),
    );

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    tx.sign(keypair);

    return tx.serialize().toString("base64");
  }

  return {
    keypair,
    connection,
    usdcMint,
    getAddress,
    getUSDCBalance,
    transferUSDC,
    signUSDCTransfer,
  };
}
