import type Anthropic from "@anthropic-ai/sdk";
import { HTLC_ABI, LockState, type ChainConfig } from "@payproof/contracts";
import { deriveLockPDA } from "@payproof/client";
import { payproofClient } from "./client-instance";
import { MARKETPLACE_APIS, TOTAL_COST } from "./marketplace";
import { getEnabledChains, getDirectChains } from "./chain-config";
import { PublicKey } from "@solana/web3.js";
import { formatUnits } from "viem";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Build tool definitions dynamically from enabled chain configuration. */
function buildToolDefinitions(): Anthropic.Tool[] {
  const enabledChains = getEnabledChains();
  const directChains = getDirectChains();
  const enabledIds = enabledChains.map((c) => c.id);
  const directIds = directChains.map((c) => c.id);
  const chainLabels = enabledChains.map((c) => `${c.id} (${c.label}, ${c.scheme})`).join(", ");

  const tools: Anthropic.Tool[] = [
    {
      name: "check_wallet_balance",
      description:
        `Check the agent's USDC balance across all enabled chains: ${enabledChains.map((c) => c.label).join(", ")}. Use this before making purchases to find the best-funded chain.`,
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "list_available_apis",
      description:
        "List all available paid data APIs with their prices and supported payment networks. Use this to plan which data sources to purchase within the budget.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "fetch_paid_data",
      description:
        `Fetch data from an x402-paywalled API endpoint. Handles USDC payment via x402. Check your balances first and specify the preferred_network with the most funds. Supports: ${chainLabels}. The endpoint must be one of: weather, markets, sentiment.`,
      input_schema: {
        type: "object" as const,
        properties: {
          endpoint: {
            type: "string",
            enum: ["weather", "markets", "sentiment"],
            description: "The data endpoint to fetch from",
          },
          preferred_network: {
            type: "string",
            enum: enabledIds,
            description: "Preferred payment network — pick the one where you have the most USDC balance",
          },
        },
        required: ["endpoint"],
      },
    },
    {
      name: "check_pending_payments",
      description:
        "Check the on-chain status of all HTLC payment locks created this session. Shows whether each lock is still locked, has been claimed by the server, or has been refunded. Also indicates whether a locked payment is refundable (timelock expired).",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
  ];

  // Refund tool — only if there are direct (HTLC) chains enabled
  if (directIds.length > 0) {
    tools.push({
      name: "refund_expired_lock",
      description:
        "Refund an expired HTLC lock to recover funds. The lock must be in 'Locked' state on-chain and its timelock must have expired. Use check_pending_payments first to find refundable locks.",
      input_schema: {
        type: "object" as const,
        properties: {
          lock_id: {
            type: "string",
            description: "The lock ID (hex) to refund",
          },
          network: {
            type: "string",
            enum: directIds,
            description: "The network the lock was created on",
          },
        },
        required: ["lock_id", "network"],
      },
    });
  }

  // Arc transfer tool — only if Arc is enabled
  if (enabledIds.includes("eip155:5042002")) {
    tools.push({
      name: "transfer_usdc_arc",
      description:
        "Transfer USDC on Arc Testnet to a specified address. Use this for direct peer-to-peer payments.",
      input_schema: {
        type: "object" as const,
        properties: {
          to: {
            type: "string",
            description: "The recipient address (0x...)",
          },
          amount: {
            type: "string",
            description: "Amount of USDC to send (e.g. '1.00')",
          },
        },
        required: ["to", "amount"],
      },
    });
  }

  return tools;
}

export const toolDefinitions: Anthropic.Tool[] = buildToolDefinitions();

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { evmWallet, arcWallet, solanaWallet, lockStore, htlcClient, htlcSolanaClient } = payproofClient;

  switch (name) {
    case "check_wallet_balance": {
      const enabledChains = getEnabledChains();
      const balancePromises = enabledChains.map(async (chain) => {
        try {
          if (chain.id === "eip155:84532") {
            return {
              chain: chain.label,
              network: chain.id,
              address: evmWallet.account.address,
              usdc_balance: await evmWallet.getBaseUSDCBalance(),
              payment_scheme: chain.scheme,
            };
          } else if (chain.id === "eip155:5042002") {
            return {
              chain: chain.label,
              network: chain.id,
              address: evmWallet.account.address,
              usdc_balance: await arcWallet.getArcUSDCBalance(),
              payment_scheme: chain.scheme,
              note: "USDC is native gas token — no separate gas needed",
            };
          } else if (chain.family === "solana" && solanaWallet) {
            return {
              chain: chain.label,
              network: chain.id,
              address: solanaWallet.getAddress(),
              usdc_balance: await solanaWallet.getUSDCBalance(),
              payment_scheme: chain.scheme,
              note: "Needs SOL for gas",
            };
          }
          return null;
        } catch {
          return {
            chain: chain.label,
            network: chain.id,
            address: "unknown",
            usdc_balance: "error",
            payment_scheme: chain.scheme,
          };
        }
      });

      const results = (await Promise.all(balancePromises)).filter(Boolean);
      return JSON.stringify({ chains: results });
    }

    case "list_available_apis": {
      return JSON.stringify({
        apis: MARKETPLACE_APIS.map((api) => ({
          endpoint: api.endpoint,
          url: `${APP_URL}/api/provider/${api.endpoint}`,
          price: api.price,
          description: api.description,
          payment_networks: api.networks.map((n) => ({
            name: n.label,
            scheme: n.scheme,
            network: n.network,
          })),
        })),
        total_cost_all: `$${TOTAL_COST.toFixed(3)}`,
        note: "Each API accepts payment on any of the listed networks. The x402 client auto-selects the best option.",
      });
    }

    case "fetch_paid_data": {
      const endpoint = input.endpoint as string;
      const url = `${APP_URL}/api/provider/${endpoint}`;
      const priceMap: Record<string, string> = Object.fromEntries(
        MARKETPLACE_APIS.map((api) => [api.endpoint, api.priceNum.toFixed(6)])
      );
      const preferredNetwork = (input.preferred_network as string) || null;
      const requestTimestamp = Date.now();
      try {
        payproofClient.setPreferredNetwork(preferredNetwork);
        const response = await payproofClient.getFetchWithPayment()(url);

        const paymentResponseHeader =
          response.headers.get("X-PAYMENT-RESPONSE") ||
          response.headers.get("PAYMENT-RESPONSE");

        let paymentMeta: Record<string, unknown> = {};
        if (paymentResponseHeader) {
          try {
            paymentMeta = JSON.parse(
              Buffer.from(paymentResponseHeader, "base64").toString(),
            );
          } catch {
            try { paymentMeta = JSON.parse(paymentResponseHeader); } catch { /* ignore */ }
          }
        }

        if (!response.ok) {
          const body = await response.text();
          return JSON.stringify({
            success: false,
            error: `HTTP ${response.status}`,
            status: response.status,
            endpoint,
            url,
            amount: priceMap[endpoint] || "unknown",
            symbol: "USDC",
            timestamp: requestTimestamp,
            epoch: Math.floor(requestTimestamp / 1000),
            message: body || "Payment failed — no response body",
            settlement: Object.keys(paymentMeta).length > 0 ? paymentMeta : undefined,
          });
        }

        const data = await response.json();
        const settlement = Object.keys(paymentMeta).length > 0 ? paymentMeta : undefined;

        return JSON.stringify({
          success: true,
          endpoint,
          url,
          status: response.status,
          payment: {
            amount: priceMap[endpoint] || "unknown",
            symbol: "USDC",
            chain: (settlement as Record<string, unknown>)?.chain || "unknown",
            network: (settlement as Record<string, unknown>)?.network || "unknown",
            sender: (settlement as Record<string, unknown>)?.sender || "unknown",
            receiver: (settlement as Record<string, unknown>)?.receiver || "unknown",
            txHash: (settlement as Record<string, unknown>)?.transaction || "unknown",
            explorerUrl: (settlement as Record<string, unknown>)?.explorerUrl || null,
            lockId: (settlement as Record<string, unknown>)?.lockId || null,
            status: (settlement as Record<string, unknown>)?.status || "completed",
            timestamp: requestTimestamp,
            epoch: Math.floor(requestTimestamp / 1000),
          },
          data,
        });
      } catch (err) {
        return JSON.stringify({
          success: false,
          error: "Payment or fetch failed",
          endpoint,
          url,
          amount: priceMap[endpoint] || "unknown",
          symbol: "USDC",
          timestamp: requestTimestamp,
          epoch: Math.floor(requestTimestamp / 1000),
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    case "transfer_usdc_arc": {
      const to = input.to as `0x${string}`;
      const amount = input.amount as string;
      try {
        const txHash = await arcWallet.transferArcUSDC(to, amount);
        return JSON.stringify({
          success: true,
          chain: "Arc Testnet",
          txHash,
          amount,
          to,
          explorer: `https://testnet.arcscan.app/tx/${txHash}`,
        });
      } catch (err) {
        return JSON.stringify({
          error: "Arc transfer failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    case "check_pending_payments": {
      const locks = await lockStore.getAll();
      if (locks.length === 0) {
        return JSON.stringify({ locks: [], message: "No HTLC locks created this session." });
      }

      const now = Math.floor(Date.now() / 1000);
      const htlcAddress = (process.env.HTLC_CONTRACT_ADDRESS ||
        "0x0000000000000000000000000000000000000000") as `0x${string}`;

      const results = await Promise.all(
        locks.map(async (lock) => {
          let onChainState: string = "unknown";
          let refundable = false;

          try {
            if (lock.network === "eip155:5042002") {
              const lockData = await arcWallet.arcPublicClient.readContract({
                address: htlcAddress,
                abi: HTLC_ABI,
                functionName: "getLock",
                args: [lock.lockId as `0x${string}`],
              });
              const data = lockData as unknown as { state: number; timelock: bigint };
              const stateNames = ["Empty", "Locked", "DataPosted", "Confirmed", "Claimed", "Refunded", "Treasury"];
              onChainState = stateNames[data.state] || `Unknown(${data.state})`;
              refundable = data.state === LockState.Locked && Number(data.timelock) <= now;

              if (data.state === LockState.Claimed) await lockStore.updateStatus(lock.lockId, "claimed_by_server");
              else if (data.state === LockState.Refunded) await lockStore.updateStatus(lock.lockId, "refunded");
            } else if (lock.network === "solana:devnet" && solanaWallet) {
              const connection = solanaWallet.connection;
              const htlcProgramId = process.env.HTLC_SOLANA_PROGRAM_ID;
              if (!htlcProgramId) {
                onChainState = "error: HTLC_SOLANA_PROGRAM_ID not configured";
                return {
                  lockId: lock.lockId,
                  network: lock.network,
                  amount: formatUnits(BigInt(lock.amount), 6) + " USDC",
                  localStatus: lock.status,
                  onChainState,
                  refundable: false,
                  timelockExpiry: new Date(lock.timelock * 1000).toISOString(),
                  timelockExpired: lock.timelock <= now,
                };
              }
              const lockPDA = lock.lockPDA
                ? new PublicKey(lock.lockPDA)
                : deriveLockPDA(Buffer.from(lock.lockId, "hex"), new PublicKey(htlcProgramId))[0];
              const accountInfo = await connection.getAccountInfo(lockPDA);
              if (!accountInfo) {
                onChainState = "NotFound";
              } else {
                const data = accountInfo.data;
                if (data.length >= 186) {
                  const timelock = Number(data.readBigInt64LE(144));
                  const state = data[152];
                  const stateNames = ["Empty", "Locked", "DataPosted", "Confirmed", "Claimed", "Refunded", "Treasury"];
                  onChainState = stateNames[state] || `Unknown(${state})`;
                  refundable = state === 1 && timelock <= now;

                  if (state === 4) await lockStore.updateStatus(lock.lockId, "claimed_by_server");
                  else if (state === 5) await lockStore.updateStatus(lock.lockId, "refunded");
                }
              }
            }
          } catch (err) {
            onChainState = `error: ${err instanceof Error ? err.message : String(err)}`;
          }

          return {
            lockId: lock.lockId,
            network: lock.network,
            amount: formatUnits(BigInt(lock.amount), 6) + " USDC",
            localStatus: lock.status,
            onChainState,
            refundable,
            timelockExpiry: new Date(lock.timelock * 1000).toISOString(),
            timelockExpired: lock.timelock <= now,
          };
        }),
      );

      return JSON.stringify({ locks: results });
    }

    case "refund_expired_lock": {
      const lockId = input.lock_id as string;
      const network = input.network as string;
      const now = Math.floor(Date.now() / 1000);
      const htlcAddress = (process.env.HTLC_CONTRACT_ADDRESS ||
        "0x0000000000000000000000000000000000000000") as `0x${string}`;

      const lock = await lockStore.get(lockId);

      try {
        if (network === "eip155:5042002") {
          const lockData = await arcWallet.arcPublicClient.readContract({
            address: htlcAddress,
            abi: HTLC_ABI,
            functionName: "getLock",
            args: [lockId as `0x${string}`],
          });
          const data = lockData as unknown as { state: number; timelock: bigint };

          if (data.state !== LockState.Locked) {
            return JSON.stringify({
              success: false,
              error: `Lock is not in Locked state (state=${data.state})`,
              lockId,
            });
          }
          if (Number(data.timelock) > now) {
            const secsLeft = Number(data.timelock) - now;
            return JSON.stringify({
              success: false,
              error: `Timelock has not expired yet — ${secsLeft}s remaining`,
              lockId,
              expiresAt: new Date(Number(data.timelock) * 1000).toISOString(),
            });
          }

          const txHash = await htlcClient.refundLock(lockId as `0x${string}`);
          if (lock) await lockStore.updateStatus(lockId, "refunded");

          return JSON.stringify({
            success: true,
            chain: "Arc Testnet",
            lockId,
            txHash,
            amount: lock ? formatUnits(BigInt(lock.amount), 6) + " USDC" : "unknown",
            explorer: `https://testnet.arcscan.app/tx/${txHash}`,
          });
        } else if (network === "solana:devnet") {
          if (!htlcSolanaClient || !solanaWallet) {
            return JSON.stringify({ success: false, error: "Solana HTLC client not configured" });
          }

          const lockIdBuf = Buffer.from(lockId, "hex");
          const [lockPDA] = htlcSolanaClient.deriveLockPDA(lockIdBuf);

          const connection = solanaWallet.connection;
          const accountInfo = await connection.getAccountInfo(lockPDA);
          if (!accountInfo) {
            return JSON.stringify({
              success: false,
              error: "Lock account not found on-chain",
              lockId,
            });
          }
          const acctData = accountInfo.data;
          if (acctData.length >= 186) {
            const timelock = Number(acctData.readBigInt64LE(144));
            const state = acctData[152];
            if (state !== 1) {
              return JSON.stringify({
                success: false,
                error: `Lock is not in Locked state (state=${state})`,
                lockId,
              });
            }
            if (timelock > now) {
              const secsLeft = timelock - now;
              return JSON.stringify({
                success: false,
                error: `Timelock has not expired yet — ${secsLeft}s remaining`,
                lockId,
                expiresAt: new Date(timelock * 1000).toISOString(),
              });
            }
          }

          const signature = await htlcSolanaClient.refundLockSolana(lockIdBuf);
          if (lock) await lockStore.updateStatus(lockId, "refunded");

          return JSON.stringify({
            success: true,
            chain: "Solana Devnet",
            lockId,
            txHash: signature,
            amount: lock ? formatUnits(BigInt(lock.amount), 6) + " USDC" : "unknown",
            explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
          });
        }

        return JSON.stringify({ success: false, error: `Unsupported network: ${network}` });
      } catch (err) {
        return JSON.stringify({
          success: false,
          error: "Refund failed",
          lockId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
