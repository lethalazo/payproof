# SDK Guide

## For Merchants (Server SDK)

### Installation

```bash
npm install @payproof/server @payproof/contracts
```

### Setup

```typescript
import { createPayproofServer } from "@payproof/server";
import { createNextMiddleware } from "@payproof/server/next";

// 1. Create server
const server = createPayproofServer({
  merchantEvmAddress: "0xYourMerchantAddress",
  merchantEvmPrivateKey: process.env.MERCHANT_PRIVATE_KEY!,
  htlcContractAddress: "0xHTLCContractAddress" as `0x${string}`,
  // Optional: Solana support
  merchantSolanaPrivateKey: process.env.MERCHANT_SOLANA_PRIVATE_KEY,
  htlcSolanaProgramId: process.env.HTLC_SOLANA_PROGRAM_ID,
  // Optional: treasury for disputes
  treasuryAddress: process.env.TREASURY_ADDRESS,
});

// 2. Define paywalled routes
const routes = {
  "/api/weather": {
    accepts: server.multiChainAccepts("$0.01"),
    description: "Weather intelligence data",
  },
  "/api/markets": {
    accepts: server.multiChainAccepts("$0.05"),
    description: "Market analysis",
  },
};

// 3. Create middleware
export const middleware = createNextMiddleware(server, routes);
export const config = { matcher: "/api/:path*" };
```

### Route Handlers

Route handlers return data normally — encryption and on-chain settlement are handled by the middleware:

```typescript
// app/api/weather/route.ts
export async function GET() {
  const data = await getWeatherData();
  return Response.json(data);
}
```

That's it. The middleware intercepts requests, handles 402 responses, verifies payments, encrypts data, posts the dataHash on-chain, returns the encrypted payload, and claims payment — all transparently.

### Server Configuration Reference

```typescript
interface PayproofServerConfig {
  // Required
  merchantEvmAddress: string;       // Receives USDC payments
  merchantEvmPrivateKey: string;    // Signs HTLC claims on EVM
  htlcContractAddress: `0x${string}`;  // HTLC contract on Arc

  // Optional — Solana support
  merchantSolAddress?: string;      // Solana payment address
  merchantSolanaPrivateKey?: string; // Signs claims on Solana
  htlcSolanaProgramId?: string;     // Anchor program ID
  solanaUsdcMint?: string;          // USDC mint (defaults to devnet)
  solanaRpcUrl?: string;            // RPC URL (defaults to devnet)

  // Optional — hosted facilitator for exact scheme
  hostedFacilitatorUrl?: string;    // Defaults to "https://x402.org/facilitator"

  // Optional — dispute resolution
  treasuryAddress?: string;         // Treasury for unresolvable disputes

  // Optional — pluggable stores
  preimageStore?: PreimageStore;    // Defaults to MemoryPreimageStore (5-min TTL)
  ledgerStore?: LedgerStore;        // Defaults to MemoryLedgerStore
}
```

### Accessing Server Components

The `createPayproofServer()` factory returns several components for advanced use:

```typescript
const server = createPayproofServer(config);

// The underlying x402 resource server
server.resourceServer;

// The HTLC facilitator (verify, postDataHash, claimAfterConfirmation)
server.facilitator;

// The direct transfer scheme handler
server.directServer;

// Store instances
server.preimageStore;
server.ledgerStore;

// Helper: generate multi-chain payment accepts for a price
server.multiChainAccepts("$0.01");
// Returns: [
//   { scheme: "exact", network: "eip155:84532", payTo: "...", price: "$0.01", ... },
//   { scheme: "direct", network: "eip155:5042002", payTo: "...", price: "$0.01", ... },
//   { scheme: "direct", network: "solana:devnet", payTo: "...", price: "$0.01", ... },
// ]
```

## For Agents (Client SDK)

### Installation

```bash
npm install @payproof/client @payproof/contracts
```

### Setup

```typescript
import { createPayproofClient } from "@payproof/client";

const client = createPayproofClient({
  evmPrivateKey: process.env.AGENT_PRIVATE_KEY!,
  htlcContractAddress: "0xHTLCContractAddress" as `0x${string}`,
  // Optional: Solana support
  solanaPrivateKey: process.env.AGENT_SOLANA_PRIVATE_KEY,
  htlcSolanaProgramId: process.env.HTLC_SOLANA_PROGRAM_ID,
  solanaUsdcMint: process.env.SOLANA_USDC_MINT,
});
```

### Making Paid API Calls

```typescript
// Get the payment-aware fetch function
const fetchWithPayment = client.getFetchWithPayment();

// Use it like normal fetch — payment + decryption is automatic
const response = await fetchWithPayment("https://api.example.com/weather");
const data = await response.json(); // plaintext data
```

### Network Selection

```typescript
// Prefer a specific chain
client.setPreferredNetwork("eip155:5042002");  // Arc
client.setPreferredNetwork("solana:devnet");    // Solana
client.setPreferredNetwork("eip155:84532");     // Base Sepolia (exact scheme)
client.setPreferredNetwork(null);               // Auto-select (prefers direct)
```

### Lock Management

```typescript
// Check all pending locks
const allLocks = await client.lockStore.getAll();
const lockedOnly = await client.lockStore.getAll("locked");

// Get a specific lock
const lock = await client.lockStore.get("0xLockId...");
// lock.encryptedPayload contains the EncryptedPayload for retry

// Refund an expired lock (Arc)
const txHash = await client.htlcClient.refundLock("0xLockId..." as `0x${string}`);

// Refund an expired lock (Solana)
const lockIdBuf = Buffer.from("lockIdHex", "hex");
const signature = await client.htlcSolanaClient!.refundLockSolana(lockIdBuf);
```

### Wallet Operations

```typescript
// Check balances
const baseBalance = await client.evmWallet.getBaseUSDCBalance();
const arcBalance = await client.arcWallet.getArcUSDCBalance();
const solBalance = await client.solanaWallet?.getUSDCBalance();

// Transfer USDC on Arc
const txHash = await client.arcWallet.transferArcUSDC("0xRecipient", "1.00");

// Get addresses
const evmAddress = client.evmWallet.account.address;    // Same for Base + Arc
const solAddress = client.solanaWallet?.getAddress();
```

### Client Configuration Reference

```typescript
interface PayproofClientConfig {
  // Required
  evmPrivateKey: string;              // Agent's EVM private key (hex)
  htlcContractAddress: `0x${string}`; // HTLC contract on Arc

  // Optional — Solana support
  solanaPrivateKey?: string;          // Agent's Solana keypair (base58)
  htlcSolanaProgramId?: string;      // Anchor program ID
  solanaUsdcMint?: string;           // USDC mint (defaults to devnet)
  solanaRpcUrl?: string;             // RPC URL (defaults to devnet)

  // Optional — pluggable store
  lockStore?: LockStore;             // Defaults to MemoryLockStore
}
```

## For AI Agents (Tool Integration)

### Pre-Built Agent Tools

The reference app includes 8 tools for AI agent integration:

| Tool | Purpose |
|------|---------|
| `check_wallet_balance` | Query USDC balance across all 3 chains |
| `list_available_apis` | Browse marketplace catalog with prices |
| `fetch_paid_data` | Purchase data from a paywalled endpoint |
| `check_arc_balance` | Arc-specific balance check |
| `check_solana_balance` | Solana-specific balance check |
| `transfer_usdc_arc` | Direct USDC transfer on Arc |
| `check_pending_payments` | Inspect on-chain status of all HTLC locks |
| `refund_expired_lock` | Recover funds from expired locks |

### Integration with Function-Calling

Pass tools to Claude, OpenAI, or any function-calling model:

```typescript
import { toolDefinitions, executeTool } from "./tools";

// Claude
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  tools: toolDefinitions,
  messages: [{ role: "user", content: "Buy weather data on Arc" }],
});

// Handle tool calls
for (const block of response.content) {
  if (block.type === "tool_use") {
    const result = await executeTool(block.name, block.input);
    // Send result back to model
  }
}
```

### Budget Management

The agent system prompt includes budget tracking:

```typescript
const systemPrompt = `You have a budget of $${budget} USDC.
Track your spending. Stop when budget is exhausted.
Always check balances before purchasing.
Prefer the chain with the most funds.`;
```

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `missing_lock_id` | Payment header without lockId | Client SDK bug — lockId should be included |
| `not_locked` | Lock state mismatch | Lock was already claimed/refunded/treasury |
| `wrong_recipient` | Lock recipient doesn't match merchant | Client locked to wrong address |
| `insufficient_amount` | Lock amount < required | Rounding issue or price changed |
| `wrong_hashlock` | Hashlock mismatch | Enhancement cache expired (60s TTL) — retry |
| `expired` | Timelock already passed | Agent took too long — lock is refundable |
| `Preimage not found` | Server preimage expired | PreimageStore TTL (5 min) exceeded |
| `post_data_hash_failed` | On-chain tx reverted | Check gas, contract state, network status |
| `hash mismatch` | receiptHash != dataHash | Corrupted encrypted payload |

### Retry Strategy

For transient failures:
1. **402 retry**: Automatic — x402 client retries with payment
2. **Lock confirmation**: SDK polls with 3s intervals, up to 60s
3. **Claim after confirmation**: Background polling with 3s intervals, up to 3 minutes
4. **Solana confirmation**: Falls back to `getSignatureStatuses` on timeout

## Examples

### Weather API Purchase

```typescript
const client = createPayproofClient({
  evmPrivateKey: process.env.AGENT_KEY!,
  htlcContractAddress: "0x..." as `0x${string}`,
});

const fetch = client.getFetchWithPayment();
client.setPreferredNetwork("eip155:5042002"); // Arc

const response = await fetch("https://marketplace.example.com/api/provider/weather");
const weather = await response.json();
console.log(weather.data.regions[0].temperature); // { current: 72.5, unit: "F", trend: "rising" }
```

### Multi-Chain Agent

```typescript
const client = createPayproofClient({
  evmPrivateKey: process.env.AGENT_KEY!,
  htlcContractAddress: "0x..." as `0x${string}`,
  solanaPrivateKey: process.env.AGENT_SOL_KEY!,
  htlcSolanaProgramId: "GigEY98avKBtVEtJpqytTdSfEaCnULZNuE5Nyx98R7Yh",
});

// Check which chain has the most funds
const arcBalance = await client.arcWallet.getArcUSDCBalance();
const solBalance = await client.solanaWallet?.getUSDCBalance() ?? "0";

const bestChain = parseFloat(arcBalance) > parseFloat(solBalance)
  ? "eip155:5042002"
  : "solana:devnet";

client.setPreferredNetwork(bestChain);
const response = await client.getFetchWithPayment()("https://api.example.com/markets");
```

### Lock Recovery

```typescript
// Check for stuck locks
const locks = await client.lockStore.getAll("locked");
const now = Math.floor(Date.now() / 1000);

for (const lock of locks) {
  if (lock.timelock <= now) {
    console.log(`Refunding expired lock ${lock.lockId}`);
    if (lock.network === "eip155:5042002") {
      await client.htlcClient.refundLock(lock.lockId as `0x${string}`);
    }
    await client.lockStore.updateStatus(lock.lockId, "refunded");
  }
}
```
