import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  type PublicClient,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { USDC_ABI, USDC_ASSETS } from "@payproof/contracts";

type LocalAccount = ReturnType<typeof privateKeyToAccount>;

export interface EvmWalletConfig {
  privateKey: string;
}

export interface EvmWallet {
  account: LocalAccount;
  /** Use as PublicClient — chain-parameterized internally. */
  basePublicClient: PublicClient;
  getBaseUSDCBalance(): Promise<string>;
}

export function createEvmWallet(config: EvmWalletConfig): EvmWallet {
  const hex = config.privateKey.startsWith("0x")
    ? config.privateKey
    : `0x${config.privateKey}`;
  const account = privateKeyToAccount(hex as `0x${string}`);

  const basePublicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  async function getBaseUSDCBalance(): Promise<string> {
    const usdcAddress = USDC_ASSETS["eip155:84532"].address as `0x${string}`;
    const balance = await basePublicClient.readContract({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    return formatUnits(balance, 6);
  }

  return {
    account,
    basePublicClient: basePublicClient as unknown as PublicClient,
    getBaseUSDCBalance,
  };
}
