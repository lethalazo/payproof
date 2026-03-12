# Architecture Overview

## System Overview

Payproof is a monorepo with three SDK packages and a reference application:

```
payproof/
├── packages/
│   ├── contracts/    @payproof/contracts   Shared types, ABIs, chain configs
│   ├── server/       @payproof/server      Merchant SDK — payment gating + settlement
│   └── client/       @payproof/client      Agent SDK — payment + decryption
├── programs/
│   └── htlc-solana/                        Solana HTLC program (Anchor/Rust)
└── apps/
    └── marketplace/                        Reference Next.js app
```

The SDK packages are published independently. The marketplace app demonstrates the full protocol end-to-end and serves as integration documentation.

## Component File Map

| File | Role |
|------|------|
| `packages/contracts/src/htlc-abi.ts` | HTLC_ABI, REGISTRY_ABI, LockState enum (7 states: Empty→Treasury) |
| `packages/contracts/src/types.ts` | Canonical types: PaymentPayload, EncryptedPayload, PendingLock, MerchantTransaction |
| `packages/contracts/src/networks.ts` | Chain configs: USDC_ASSETS, arcTestnet, REGISTRY_ADDRESSES, DEFAULT_TIMELOCK_SECONDS |
| `packages/server/src/facilitator.ts` | DirectTransferFacilitator: verify(), postDataHash(), claimAfterConfirmation() |
| `packages/server/src/x402-direct-server.ts` | DirectTransferServer: parsePrice(), enhancePaymentRequirements() with hashlock generation |
| `packages/server/src/adapters/next.ts` | createNextMiddleware(): scheme-based routing — exact (passthrough) vs direct (encrypted) |
| `packages/server/src/gate.ts` | createPayproofServer(): wires facilitator + scheme handlers + stores |
| `packages/server/src/stores/preimage-store.ts` | PreimageStore interface + MemoryPreimageStore (30-min TTL) |
| `packages/server/src/stores/ledger-store.ts` | LedgerStore interface + MemoryLedgerStore (revenue tracking) |
| `packages/server/src/crypto/encryption.ts` | Server-side encrypt() + computeSHA256() using Web Crypto |
| `packages/server/src/context/request-context.ts` | AbortSignal propagation for client disconnect detection |
| `packages/client/src/client.ts` | createPayproofClient(): wires wallets + HTLC clients + x402 wrapper |
| `packages/client/src/x402/x402-direct-client.ts` | DirectTransferClient: creates HTLC locks for payment (EVM + Solana) |
| `packages/client/src/x402/x402.ts` | createX402ClientWrapper(): x402 integration, encrypted response pipeline |
| `packages/client/src/evm/htlc-client.ts` | createHtlcClient(): lock, confirmReceipt, watchForClaim, refund on Arc EVM |
| `packages/client/src/evm/arc.ts` | createArcWallet(): USDC balance + transfers on Arc Testnet |
| `packages/client/src/solana/htlc-solana-client.ts` | createHtlcSolanaClient(): lockFunds, confirmReceipt, watchForClaim, refund on Solana |
| `packages/client/src/solana/solana.ts` | createSolanaWallet(): USDC + SOL balance on Solana Devnet |
| `packages/client/src/stores/lock-store.ts` | LockStore interface + MemoryLockStore (pending lock tracking) |
| `packages/client/src/crypto/encryption.ts` | Client-side decrypt() + computeSHA256() using Web Crypto |
| `programs/htlc-solana/src/lib.rs` | Anchor program: 7 instructions, 7 states, 258-byte LockAccount |
| `packages/contracts/programs/htlc-solana/src/lib.rs` | Reference copy of Solana program (same as programs/htlc-solana) |

## Package Architecture

### `@payproof/contracts`

The shared foundation — imported by both client and server.

| Module | Exports | Purpose |
|--------|---------|---------|
| `htlc-abi.ts` | `HTLC_ABI`, `REGISTRY_ABI`, `LockState` | Contract ABIs and state enum |
| `types.ts` | `EncryptedPayload`, `PendingLock`, `PaymentRequirements`, `SettleResponse`, etc. | Canonical type definitions |
| `networks.ts` | `USDC_ASSETS`, `arcTestnet`, `EXPLORER_URLS`, `DEFAULT_TIMELOCK_SECONDS`, `PROTOCOL_VERSION`, `REGISTRY_ADDRESSES` | Chain configurations and constants |

### `@payproof/server`

The merchant-side SDK. Handles payment verification, data encryption, on-chain settlement, and claim.

| Module | Key Exports | Role |
|--------|-------------|------|
| `gate.ts` | `createPayproofServer()`, `PayproofServer`, `RouteConfig` | Factory — creates server with facilitator, scheme handlers, stores |
| `facilitator.ts` | `DirectTransferFacilitator` | On-chain operations: `verify()`, `postDataHash()`, `claimAfterConfirmation()` |
| `x402-direct-server.ts` | `DirectTransferServer` | Price parsing, hashlock generation, payment requirement enhancement |
| `adapters/next.ts` | `createNextMiddleware()` | Next.js middleware — orchestrates the full encrypted flow |
| `stores/preimage-store.ts` | `PreimageStore`, `MemoryPreimageStore` | Preimage generation and retrieval (30-min TTL) |
| `stores/ledger-store.ts` | `LedgerStore`, `MemoryLedgerStore` | Settlement transaction recording |
| `crypto/encryption.ts` | `encrypt()`, `computeSHA256()` | AES-256-GCM encryption with preimage as key |
| `context/request-context.ts` | `runWithRequestContext()`, `isClientDisconnected()` | AbortSignal propagation for disconnect detection |

### `@payproof/client`

The agent-side SDK. Handles wallet management, HTLC locking, encrypted response processing, and decryption.

| Module | Key Exports | Role |
|--------|-------------|------|
| `client.ts` | `createPayproofClient()`, `PayproofClient` | Factory — creates client with wallets, HTLC clients, x402 wrapper |
| `x402/x402.ts` | `createX402ClientWrapper()` | x402 integration, scheme selection, encrypted response pipeline |
| `x402/x402-direct-client.ts` | `DirectTransferClient` | Creates HTLC locks for payment (EVM + Solana) |
| `evm/htlc-client.ts` | `createHtlcClient()`, `generateLockId()` | Arc HTLC operations: lock, confirmReceipt, watchForClaim, refund |
| `evm/wallet.ts` | `createEvmWallet()` | Base Sepolia wallet (balance, approvals) |
| `evm/arc.ts` | `createArcWallet()` | Arc Testnet wallet (USDC balance, transfers) |
| `solana/htlc-solana-client.ts` | `createHtlcSolanaClient()`, `deriveLockPDA()` | Solana HTLC operations |
| `solana/solana.ts` | `createSolanaWallet()` | Solana wallet (USDC + SOL balance) |
| `stores/lock-store.ts` | `LockStore`, `MemoryLockStore` | Tracks pending HTLC locks + encrypted payloads |
| `crypto/encryption.ts` | `decrypt()`, `computeSHA256()` | AES-256-GCM decryption using on-chain preimage |

## Encryption Pipeline

The HTLC preimage doubles as an AES-256-GCM encryption key. This creates mathematical atomicity: the merchant must reveal the key to get paid, and the revealed key is what the agent needs to decrypt.

### Server-side encryption

```typescript
// packages/server/src/crypto/encryption.ts
async function encrypt(
  plaintext: Uint8Array,
  preimageHex: string,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array; authTag: Uint8Array }>
```

- Key: 32-byte preimage (hex-encoded)
- Algorithm: AES-256-GCM with 12-byte random nonce
- Output: ciphertext + 12-byte nonce + 16-byte authTag (separated)
- `computeSHA256(ciphertext)` → `dataHash` posted on-chain

### Client-side decryption

```typescript
// packages/client/src/crypto/encryption.ts
async function decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  authTag: Uint8Array,
  preimageHex: string,
): Promise<Uint8Array>
```

- Reconstructs ciphertext+authTag for Web Crypto (which expects concatenated form)
- Preimage obtained from on-chain Claimed event logs

## x402 Integration Layer

### DirectTransferServer (scheme handler)

Implements the x402 server-side scheme interface:

- `parsePrice(price, network)` — Converts `"$0.001"` → `{ asset: "0x3600...", amount: "1000" }`
- `enhancePaymentRequirements(req)` — Generates hashlock via PreimageStore, adds HTLC contract address and timelock

### DirectTransferClient (scheme handler)

Implements the x402 client-side scheme interface:

- Parses 402 response to extract hashlock and HTLC contract
- Creates on-chain HTLC lock with the extracted hashlock
- Returns lockId for the payment header

### DirectTransferFacilitator (on-chain operations)

The facilitator handles all on-chain interactions:

- `verify(payload, requirements)` — Reads lock on-chain, validates sender/recipient/amount/hashlock/expiry
- `postDataHash(lockId, dataHash, network)` — Posts SHA-256 of ciphertext on-chain
- `claimAfterConfirmation(lockId, hashlock, network)` — Polls for Confirmed state, retrieves preimage, claims

## Middleware Architecture

`createNextMiddleware()` in `packages/server/src/adapters/next.ts` supports two modes:

### Exact Scheme (passthrough)

For `scheme: "exact"` payments (Permit2-based, trust model):

1. x402 base handler verifies payment
2. `settle()` stub fires (no-op for direct scheme)
3. `NextResponse.next()` — route handler serves data unencrypted

### Direct Scheme (encrypted, atomic)

For `scheme: "direct"` payments — auto-detected from the payment header:

Full atomic data-for-payment flow:

1. Parse payment header (base64 JSON)
2. `verify()` — check lock on-chain
3. Fetch route data via internal HTTP call (bypass middleware)
4. `encrypt(plaintext, preimage)` → ciphertext
5. `computeSHA256(ciphertext)` → dataHash
6. `postDataHash(lockId, dataHash)` → on-chain DataPosted state
7. Return `EncryptedPayload` JSON response with `x-payproof-encrypted: true` header
8. `claimAfterConfirmation()` fire-and-forget

## Data Flow

The 14-step protocol maps to packages as follows:

```
Step   Action                          Package               Module
────   ──────                          ───────               ──────
 1     GET /data                       client                x402.ts (fetch wrapper)
 2     402 + requirements              server                gate.ts → x402-direct-server.ts
 3     lock(USDC, hashlock)            client                x402-direct-client.ts → htlc-client.ts
 4     State: Locked                   —                     (on-chain)
 5     Retry + X-PAYMENT {lockId}      client                x402.ts (auto-retry)
 6     verify() lock on-chain          server                next.ts → facilitator.ts
 7     Fetch data from route handler   server                next.ts (passthrough)
 8     Encrypt with preimage           server                next.ts → crypto/encryption.ts
 9     postDataHash on-chain           server                next.ts → facilitator.ts
10     State: DataPosted               —                     (on-chain)
11     HTTP 200 EncryptedPayload       server                next.ts
12     confirmReceipt on-chain         client                x402.ts → htlc-client.ts
13     State: Confirmed                —                     (on-chain)
14     claim(preimage) on-chain        server                facilitator.ts (fire-and-forget)
 —     Read preimage, decrypt          client                x402.ts → crypto/encryption.ts
```

## HTLC State Machine (7 states)

```
              lock()
  Empty ─────────────► Locked
                          │
              postDataHash()
                          │
                          ▼
                      DataPosted
                       │      │
          confirmReceipt()    │ (deadline expires)
                       │      │
                       ▼      ▼
                  Confirmed  Treasury
                       │      (sendToTreasury)
                claim()│
                       │
                       ▼
                    Claimed

  Locked ───────────► Refunded
           refund()
         (timelock expired)
```

Both EVM and Solana contracts implement identical state transitions. The `CONFIRMATION_WINDOW` is 120 seconds on both chains.

## Key Design Decisions

### Why HTLC (not escrow with arbiter)

HTLCs provide deterministic resolution without a trusted third party. The state machine has exactly 7 states with clear transition rules. Every possible outcome is defined: the agent refunds, the merchant claims, or funds go to treasury. No human judgment or arbitration needed.

### Why Preimage-as-Key (atomicity)

The breakthrough insight: using the HTLC preimage as the AES encryption key creates **mathematical atomicity**. The merchant must reveal the key to get paid (via `claim(preimage)`), and the revealed key is what the agent needs to decrypt. This is a single atomic action — you can't get paid without enabling decryption.

### Why Three Chains

- **Arc Testnet**: USDC-native gas simplifies agent UX — no volatile gas token to manage
- **Solana Devnet**: Mature ecosystem, fast finality, demonstrates cross-VM compatibility
- **Base Sepolia**: x402 exact scheme compatibility — agents in the existing ecosystem can use Payproof without migration

### Why In-Memory State (prototype)

The reference app uses `MemoryPreimageStore`, `MemoryLedgerStore`, and `MemoryLockStore` for simplicity. The store interfaces are pluggable — production deployments replace them with Redis, PostgreSQL, or other persistent backends. The on-chain HTLC state is always the ultimate source of truth.

### Why Fire-and-Forget Claim

The merchant's `claimAfterConfirmation()` runs asynchronously after the HTTP response is sent. This means the agent gets the encrypted data immediately — they don't wait for the merchant to claim. The claim is a background operation that polls for the `Confirmed` state, then submits the preimage. If the claim fails, the merchant retries. If the claim never succeeds, the agent still has the encrypted data and can decrypt it once the preimage appears on-chain (from any future claim attempt).

## Runtime Layers

```
┌─────────────────────────────────────────────────────────┐
│  Browser UI — React dashboard with Tailwind CSS          │
│  (AgentChat, MarketplaceGrid, MerchantDashboard)        │
└────────────────────┬────────────────────────────────────┘
                     │ SSE stream
┌────────────────────▼────────────────────────────────────┐
│  Next.js API Routes                                      │
│  POST /api/agent — Claude agent loop with tools          │
│  GET /api/wallet — agent balances (3 chains)             │
│  GET /api/merchant — merchant balances + revenue         │
│  GET /api/provider/* — paywalled data endpoints          │
└────────────────────┬────────────────────────────────────┘
                     │ payment gate
┌────────────────────▼────────────────────────────────────┐
│  x402 Middleware (createNextMiddleware)                   │
│  ├── No payment header → 402 with requirements           │
│  ├── Exact scheme → passthrough to x402 base handler     │
│  └── Direct scheme → verify → encrypt → postDataHash     │
│                       → return EncryptedPayload           │
│                       → fire-and-forget claim             │
└────────────────────┬────────────────────────────────────┘
                     │ on-chain txs (viem / @solana/web3.js)
┌────────────────────▼────────────────────────────────────┐
│  Smart Contracts                                         │
│  ├── HTLC.sol on Arc Testnet (EVM, Foundry)             │
│  ├── htlc_solana on Solana Devnet (Anchor)              │
│  └── PayproofRegistry on Arc (version management)        │
└─────────────────────────────────────────────────────────┘
```
