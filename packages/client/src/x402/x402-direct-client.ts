import { PublicKey } from "@solana/web3.js";
import type { PaymentRequirements, PaymentPayloadResult } from "@payproof/contracts";
import { USDC_ASSETS } from "@payproof/contracts";
import { generateLockId, type createHtlcClient } from "../evm/htlc-client.js";
import { generateSolanaLockId, type createHtlcSolanaClient } from "../solana/htlc-solana-client.js";

export interface DirectTransferClientConfig {
  htlcClient: ReturnType<typeof createHtlcClient>;
  htlcSolanaClient?: ReturnType<typeof createHtlcSolanaClient>;
}

/**
 * Client-side scheme for "direct" HTLC transfers.
 *
 * Instead of signing a raw transfer, the client locks funds in an on-chain
 * HTLC escrow. The server can only claim by revealing the preimage.
 * If the server never claims, the client refunds after timeout.
 */
export class DirectTransferClient {
  readonly scheme = "direct";

  private htlcClient: ReturnType<typeof createHtlcClient>;
  private htlcSolanaClient?: ReturnType<typeof createHtlcSolanaClient>;

  constructor(config: DirectTransferClientConfig) {
    this.htlcClient = config.htlcClient;
    this.htlcSolanaClient = config.htlcSolanaClient;
  }

  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<PaymentPayloadResult> {
    const { network, payTo, amount, extra } = paymentRequirements;

    const hashlock = extra?.hashlock as string | undefined;
    const timelockSeconds = (extra?.timelockSeconds as number) || 300;

    if (!hashlock) {
      throw new Error(
        "DirectTransferClient: missing hashlock in payment requirements. Server must provide extra.hashlock.",
      );
    }

    if (network === "eip155:5042002") {
      const amountBigInt = BigInt(amount);
      const usdcArc = USDC_ASSETS["eip155:5042002"].address as `0x${string}`;

      await this.htlcClient.approveUSDCForHTLC(amountBigInt);

      const lockId = generateLockId();

      await this.htlcClient.lockFunds({
        lockId,
        recipient: payTo as `0x${string}`,
        token: usdcArc,
        amount: amountBigInt,
        hashlock: hashlock as `0x${string}`,
        timelockSeconds,
      });

      return {
        x402Version,
        payload: {
          lockId,
          network,
          hashlock,
        },
      };
    } else if (network === "solana:devnet") {
      if (!this.htlcSolanaClient) {
        throw new Error("DirectTransferClient: Solana HTLC client not configured");
      }

      const amountBigInt = BigInt(amount);
      const lockId = generateSolanaLockId();
      const recipient = new PublicKey(payTo);

      const hashlockHex = hashlock.startsWith("0x") ? hashlock.slice(2) : hashlock;
      const hashlockBuf = Buffer.from(hashlockHex, "hex");

      const { signature, lockPDA, escrowPDA } = await this.htlcSolanaClient.lockFundsSolana({
        lockId,
        recipient,
        amount: amountBigInt,
        hashlock: hashlockBuf,
        timelockSeconds,
      });

      return {
        x402Version,
        payload: {
          lockId: lockId.toString("hex"),
          lockPDA: lockPDA.toBase58(),
          escrowPDA: escrowPDA.toBase58(),
          network,
          hashlock,
          txSignature: signature,
        },
      };
    }

    throw new Error(`DirectTransferClient: unsupported network ${network}`);
  }
}
