import {
  USDC_ASSETS,
  DEFAULT_TIMELOCK_SECONDS,
  PROTOCOL_VERSION,
  type Network,
  type Price,
  type AssetAmount,
  type PaymentRequirements,
} from "@payproof/contracts";
import type { PreimageStore } from "./stores/preimage-store.js";

export interface DirectTransferServerConfig {
  /** HTLC contract address on Arc EVM. */
  htlcContractAddress: string;
  /** Solana HTLC program ID. */
  htlcSolanaProgramId?: string;
  /** PreimageStore for generating hashlocks. */
  preimageStore: PreimageStore;
}

/**
 * Server-side scheme for "direct" transfers on Arc and Solana.
 * Converts user-friendly prices (like "$0.001") to chain-specific amounts.
 * Generates HTLC hashlocks for each payment requirement.
 */
export class DirectTransferServer {
  readonly scheme = "direct";

  private config: DirectTransferServerConfig;

  constructor(config: DirectTransferServerConfig) {
    this.config = config;
  }

  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    const config = USDC_ASSETS[network];
    if (!config) {
      throw new Error(
        `DirectTransferServer: unsupported network ${network}`,
      );
    }

    let numericPrice: number;
    if (typeof price === "string") {
      numericPrice = parseFloat(price.replace(/^\$/, ""));
    } else if (typeof price === "number") {
      numericPrice = price;
    } else {
      return price;
    }

    const amount = Math.round(numericPrice * 10 ** config.decimals).toString();

    return {
      asset: config.address,
      amount,
    };
  }

  async enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    _supportedKind: {
      x402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    _facilitatorExtensions: string[],
  ): Promise<PaymentRequirements> {
    const { hashlock } = await this.config.preimageStore.generateHashlock();

    const htlcContract =
      paymentRequirements.network === "solana:devnet"
        ? (this.config.htlcSolanaProgramId || "HTLC111111111111111111111111111111111111111")
        : this.config.htlcContractAddress;

    const enhanced: PaymentRequirements = {
      ...paymentRequirements,
      extra: {
        ...paymentRequirements.extra,
        transferType: "htlc",
        hashlock,
        htlcContract,
        timelockSeconds: DEFAULT_TIMELOCK_SECONDS,
        protocolVersion: PROTOCOL_VERSION,
      },
    };

    return enhanced;
  }
}
