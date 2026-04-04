# Payproof

**Cryptographic payments for autonomous agents. Trustless. Atomic. Non-custodial.**

Payproof is an atomic data-for-payment protocol for AI agent commerce. The HTLC preimage that unlocks payment **is** the AES-256-GCM decryption key for the data. Merchants can only get paid by revealing the key. Agents can only decrypt after confirming receipt. No trust required.

## The Problem

AI agents need to buy data and services autonomously. Current solutions (x402 "exact" scheme) require trust:

- **Payment before delivery** - agent pays, then hopes the merchant sends data
- **No defect protection** - once the payment is signed, it's broadcasted regardless of data quality
- **Centralized facilitators** - x402.org must be trusted not to steal or censor
- **No dispute resolution** - if something goes wrong, funds are lost

## The Solution

Payproof's atomic data-for-payment protocol eliminates trust from the equation:

1. **Agent locks** USDC in an on-chain HTLC escrow
2. **Merchant encrypts** data with the preimage (the HTLC secret) as the AES-256-GCM key
3. **Merchant commits** the hash of the encrypted data on-chain
4. **Agent verifies** the commitment and confirms receipt on-chain
5. **Merchant claims** payment by revealing the preimage - which the agent uses to decrypt the data

The preimage = encryption key = payment. Atomic. One reveals the other.

### Protocol at a Glance

```
Agent                           Merchant                    Chain
  │                                │                          │
  │  GET /data ─────────────────>  │                          │
  │  <── 402 + hashlock ─────────  │                          │
  │                                │                          │
  │  lock(USDC, hashlock) ───────────────────────────────>  Locked
  │                                │                          │
  │  Retry + {lockId} ──────────>  │                          │
  │                                │  verify ──────────────>  ✓
  │                                │  encrypt(data, preimage) │
  │                                │  postDataHash ────────>  DataPosted
  │  <── EncryptedPayload ───────  │                          │
  │                                │                          │
  │  confirmReceipt ─────────────────────────────────────>  Confirmed
  │                                │                          │
  │                                │  claim(preimage) ─────>  Claimed
  │                                │                          │  USDC → merchant
  │  read preimage from chain      │                          │
  │  decrypt(data, preimage) ✓     │                          │
```

> Full 14-step specification: [docs/protocol.md](docs/protocol.md)

## Multi-Chain Support

| Chain | Scheme | Token | Gas | Status |
|-------|--------|-------|-----|--------|
| **Arc Testnet** | `direct` (HTLC) | USDC | USDC (native) | Primary - full atomic protocol |
| **Base Sepolia** | `exact` (Permit2) | USDC | ETH | x402 compatibility - trust-based |

Arc uses the atomic HTLC protocol. Base Sepolia uses x402's "exact" scheme via the hosted facilitator for backward compatibility.

## Quick Start

```bash
git clone https://github.com/lethalazo/payproof.git
cd payproof
pnpm install
pnpm -r build
cp apps/marketplace/.env.example apps/marketplace/.env.local
# Fill in: ANTHROPIC_API_KEY, AGENT_PRIVATE_KEY, MERCHANT_ADDRESS,
#          HTLC_CONTRACT_ADDRESS, MERCHANT_PRIVATE_KEY, TREASURY_ADDRESS
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Set a research goal and budget, watch the agent buy data with real on-chain payments.

## SDK Packages

### `@payproof/client` - Agent SDK

```typescript
import { createPayproofClient } from "@payproof/client";

const client = createPayproofClient({
  // Modular chain config - only enable what you need
  chains: {
    evm: {
      privateKey: "...",
      htlcContractAddress: "0x...",
      networks: ["eip155:5042002"],      // Arc only (omit for all EVM chains)
    },
  },
  // Auto-refund expired locks in the background
  autoRefund: {
    enabled: true,
    intervalMs: 30_000,
    onRefund: (lockId, network, txHash) => console.log(`Refunded ${lockId}`),
  },
});

// The agent only sees tools for enabled chains
console.log(client.getEnabledChains()); // [{ id: "eip155:5042002", ... }]

const fetch = client.getFetchWithPayment();
const response = await fetch("https://api.example.com/weather");
const data = await response.json(); // plaintext - decryption is automatic
```

Legacy top-level config (`evmPrivateKey`) still works for backwards compatibility.

### `@payproof/server` - Merchant SDK

```typescript
import { createPayproofServer } from "@payproof/server";
import { createNextMiddleware } from "@payproof/server/next";

const server = createPayproofServer({
  chains: {
    evm: {
      merchantAddress: "0x...",
      merchantPrivateKey: "...",
      htlcContractAddress: "0x...",
    },
  },
});

const middleware = createNextMiddleware(server, {
  "/api/weather": {
    accepts: server.multiChainAccepts("$0.01"), // only enabled chains
    description: "Weather data",
  },
});
// Route handlers return data normally - encryption + on-chain settlement is automatic
```

### `@payproof/contracts` - Shared Types & ABIs

```typescript
import { HTLC_ABI, REGISTRY_ABI, LockState, USDC_ASSETS, arcTestnet } from "@payproof/contracts";
import type { EncryptedPayload, PendingLock, PaymentRequirements } from "@payproof/contracts";
```

## Project Structure

```
payproof/
├── packages/
│   ├── client/                    # @payproof/client - agent-side SDK
│   │   └── src/
│   │       ├── client.ts          #   createPayproofClient() factory
│   │       ├── x402/              #   x402 integration + encrypted response handling
│   │       ├── evm/               #   Arc wallet + HTLC client (lock, confirm, watch)
│   │       ├── solana/            #   Solana wallet + HTLC client (SDK-level, not enabled in demo)
│   │       ├── crypto/            #   AES-256-GCM decryption
│   │       └── stores/            #   LockStore - pending payment tracking
│   ├── server/                    # @payproof/server - merchant-side SDK
│   │   └── src/
│   │       ├── gate.ts            #   createPayproofServer() factory
│   │       ├── facilitator.ts     #   verify, postDataHash, claimAfterConfirmation
│   │       ├── x402-direct-server.ts  # price parsing, hashlock generation
│   │       ├── crypto/            #   AES-256-GCM encryption
│   │       ├── stores/            #   PreimageStore, LedgerStore
│   │       ├── adapters/          #   Next.js middleware adapter
│   │       └── context/           #   AbortSignal request context
│   └── contracts/                 # @payproof/contracts - shared types & ABIs
│       └── src/
│           ├── htlc-abi.ts        #   HTLC_ABI, REGISTRY_ABI, LockState enum
│           ├── types.ts           #   EncryptedPayload, PendingLock, PaymentRequirements
│           └── networks.ts        #   Chain configs, USDC addresses, explorer URLs
├── apps/
│   └── marketplace/               # Reference Next.js app
│       └── src/
│           ├── app/api/           #   Agent SSE, wallet, merchant, paywalled providers
│           ├── components/        #   Dashboard, agent chat, marketplace grid
│           ├── lib/               #   Agent loop, tools, client/server instances
│           └── middleware.ts      #   x402 payment gate
├── contracts/
│   └── HTLC.sol                   # EVM HTLC contract (7-state)
└── programs/
    └── htlc-solana/src/lib.rs     # Solana HTLC program (Anchor, not enabled in demo)
```

## Why Payproof vs x402 Exact Scheme

| | x402 Exact | Payproof Direct |
|---|---|---|
| **Atomicity** | None - payment before data | Atomic - preimage = encryption key |
| **Trust model** | Trust facilitator + merchant | Trustless - cryptographic guarantees |
| **Dispute resolution** | None | Treasury mechanism - neutral third party |

Payproof uses x402 as the transport layer (HTTP 402, payment headers) but replaces trust with cryptography for the `direct` scheme.

## Documentation

- **[Protocol Specification (chain-agnostic)](PROTOCOL.md)** - Pure HTLC protocol spec: state machine, operations, conformance checklist
- **[Protocol + Transport](docs/protocol.md)** - 14-step flow including x402 HTTP transport, game theory, cryptographic details
- **[Architecture Overview](docs/architecture.md)** - System design, package structure, data flow
- **[Smart Contracts](docs/smart-contracts.md)** - 7-state HTLC, EVM, PayproofRegistry
- **[Payment System](docs/payment-system.md)** - Three schemes, encrypted flow, preimage management
- **[Payment Recovery](docs/payment-recovery.md)** - Failure modes, defense layers, treasury safety net
- **[SDK Guide](docs/sdk-guide.md)** - Merchant + agent integration with code examples
- **[API Reference](docs/api-reference.md)** - HTTP endpoints, agent tools, response schemas
- **[Deployment Guide](docs/deployment.md)** - Environment setup, contract deployment, key management
- **[Competitive Analysis](docs/competitive-analysis.md)** - x402, Coinbase, Circle, Arc positioning
- **[Roadmap](docs/roadmap.md)** - Enhancement roadmap with concrete milestones

## License

Apache 2.0
