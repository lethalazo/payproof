import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  encodeFunctionData,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, USDC_ABI, USDC_ASSETS } from "@payproof/contracts";

const USDC_ARC = USDC_ASSETS["eip155:5042002"].address as `0x${string}`;

export interface ArcWalletConfig {
  privateKey: string;
}

export interface ArcWallet {
  arcPublicClient: PublicClient;
  arcWalletClient: WalletClient;
  getArcUSDCBalance(): Promise<string>;
  transferArcUSDC(to: `0x${string}`, amount: string): Promise<Hash>;
  signArcUSDCTransfer(to: `0x${string}`, amount: string): Promise<`0x${string}`>;
}

export function createArcWallet(config: ArcWalletConfig): ArcWallet {
  const hex = config.privateKey.startsWith("0x")
    ? config.privateKey
    : `0x${config.privateKey}`;
  const account = privateKeyToAccount(hex as `0x${string}`);

  const arcPublicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const arcWalletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  async function getArcUSDCBalance(): Promise<string> {
    const balance = await arcPublicClient.readContract({
      address: USDC_ARC,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    return formatUnits(balance, 6);
  }

  async function transferArcUSDC(to: `0x${string}`, amount: string): Promise<Hash> {
    const parsed = parseUnits(amount, 6);
    return arcWalletClient.writeContract({
      address: USDC_ARC,
      abi: USDC_ABI,
      functionName: "transfer",
      args: [to, parsed],
    });
  }

  async function signArcUSDCTransfer(to: `0x${string}`, amount: string): Promise<`0x${string}`> {
    const parsed = parseUnits(amount, 6);
    const data = encodeFunctionData({
      abi: USDC_ABI,
      functionName: "transfer",
      args: [to, parsed],
    });
    const request = await arcWalletClient.prepareTransactionRequest({
      to: USDC_ARC,
      data,
    });
    return arcWalletClient.signTransaction(request);
  }

  return {
    arcPublicClient: arcPublicClient as unknown as PublicClient,
    arcWalletClient: arcWalletClient as unknown as WalletClient,
    getArcUSDCBalance,
    transferArcUSDC,
    signArcUSDCTransfer,
  };
}
