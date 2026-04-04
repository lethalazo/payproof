# Payment System

## x402 Protocol

[x402](https://www.x402.org/) is an HTTP standard for machine-to-machine payments. When a resource requires payment, the server returns `HTTP 402 Payment Required` with structured requirements. The client pays, retries with proof, and receives the resource.

Payproof uses x402 as the transport layer — the 402 response format, payment headers, and client/server negotiation. For the `direct` scheme, Payproof adds atomic data-for-payment guarantees on top.

## Three Payment Schemes

### Arc Testnet — `direct` (primary)

**Network**: `eip155:5042002` | **Token**: USDC (native gas) | **Contract**: HTLC.sol

Full atomic data-for-payment protocol:
- Agent locks USDC in on-chain HTLC escrow
- Merchant encrypts data with preimage, commits dataHash on-chain
- Agent confirms receipt, merchant claims by revealing preimage
- Agent decrypts using revealed preimage

**Advantage**: USDC is the native gas token on Arc — agents only need one token.

### Base Sepolia — `exact` (compatibility)

**Network**: `eip155:84532` | **Token**: USDC | **Gas**: ETH

Coinbase's Permit2-based scheme via the x402.org hosted facilitator:
- Agent signs a Permit2 allowance (off-chain)
- Server forwards to hosted facilitator
- Facilitator broadcasts on-chain
- Non-atomic: payment happens before data delivery

**Purpose**: Backward compatibility with the existing x402 ecosystem.

## Encrypted Payment Flow (Direct Scheme)

### 402 Response

When an agent requests a paywalled endpoint without payment, the server returns:

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "direct",
      "network": "eip155:5042002",
      "asset": "0x3600000000000000000000000000000000000000",
      "amount": "1000",
      "payTo": "0xMerchantAddress",
      "maxTimeoutSeconds": 60,
      "extra": {
        "transferType": "htlc",
        "hashlock": "0xSHA256OfPreimage...",
        "htlcContract": "0xHTLCContractAddress",
        "timelockSeconds": 300,
        "protocolVersion": 1
      }
    },
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "amount": "1000",
      "payTo": "0xMerchantAddress",
      "maxTimeoutSeconds": 60
    }
  ]
}
```

### Agent Locks Funds

The client SDK:
1. Selects the best payment option (prefers `direct` scheme, respects `setPreferredNetwork()`)
2. Approves the HTLC contract to spend USDC
3. Calls `lock()` with a randomly generated `lockId`, the server-provided `hashlock`, and `timelock = now + 300s`
4. Tracks the lock in `LockStore` with status `"locked"`

### Agent Retries with Payment

The client retries the original request with an `X-PAYMENT` header:

```json
{
  "x402Version": 2,
  "payload": {
    "lockId": "0xRandomLockId...",
    "network": "eip155:5042002",
    "hashlock": "0xSHA256OfPreimage..."
  },
  "accepted": {
    "scheme": "direct",
    "network": "eip155:5042002",
    "amount": "1000",
    "payTo": "0xMerchantAddress"
  }
}
```

### Server Processes Payment

The `createNextMiddleware` handler:

1. **Verify** — `facilitator.verify()` reads the lock on-chain, checks:
   - State is `Locked`
   - Recipient matches merchant address
   - Amount >= required
   - Hashlock matches server-generated hashlock
   - Timelock hasn't expired
2. **Fetch data** — Passes request through to the Next.js route handler
3. **Consume preimage** — Atomically retrieves and deletes from `PreimageStore` (prevents double-use)
4. **Encrypt** — `AES-256-GCM(plaintext, key=preimage, nonce=random_12_bytes)`
5. **Compute dataHash** — `SHA-256(ciphertext_bytes)`
6. **Post dataHash** — `facilitator.postDataHash(lockId, dataHash, network)` — on-chain tx, waits for receipt
7. **Return EncryptedPayload** — HTTP 200 with `x-payproof-encrypted: true` header:
   ```json
   {
     "encryptedBlob": "base64EncodedCiphertext",
     "nonce": "hex24chars",
     "authTag": "hex32chars",
     "dataHash": "0xSHA256OfCiphertext"
   }
   ```
8. **Fire-and-forget claim** — `facilitator.claimAfterConfirmation()` starts background polling

### Client Decryption Pipeline

The `handleEncryptedResponse` function in `x402.ts`:

1. Parse `EncryptedPayload` from response body
2. Persist `encryptedPayload` in `LockStore` (for retry safety)
3. Decode `encryptedBlob` from base64 → ciphertext bytes
4. Compute `receiptHash = SHA-256(ciphertext_bytes)`
5. Call `confirmReceipt(lockId, receiptHash)` on-chain
6. Poll for `Claimed` event via `watchForClaim()` (up to 4 min)
7. Extract preimage from `Claimed` event
8. Decrypt: `AES-256-GCM.decrypt(ciphertext, nonce, authTag, preimage)`
9. Return new `Response` with plaintext body

## Preimage Management

### Server Side (PreimageStore)

```typescript
interface PreimageStore {
  generateHashlock(): Promise<{ preimage: string; hashlock: string }>;
  getPreimage(hashlock: string): string | null | Promise<string | null>;
  consumePreimage(hashlock: string): string | null | Promise<string | null>;
}
```

- **Generation**: `crypto.getRandomValues(32 bytes)` → `SHA-256(bytes)` → `{ preimage, hashlock }`
- **TTL**: 30 minutes (MemoryPreimageStore default)
- **Lifecycle**:
  1. `generateHashlock()` — called during 402 response generation
  2. `consumePreimage()` — called during encryption in the middleware (atomic get-and-delete prevents double-use)
  3. Preimage is passed explicitly to `claimAfterConfirmation()` since it was already consumed from the store

### Client Side (LockStore)

```typescript
interface LockStore {
  add(lock: PendingLock): void | Promise<void>;
  get(lockId: string): PendingLock | undefined | Promise<PendingLock | undefined>;
  updateStatus(lockId: string, status: PendingLock["status"]): void | Promise<void>;
  getAll(filter?: PendingLock["status"]): PendingLock[] | Promise<PendingLock[]>;
}
```

Tracks every HTLC lock with status transitions: `"locked"` → `"settled"` / `"refunded"` / `"claimed_by_server"`. Also persists the `EncryptedPayload` for retry safety.

## Payment Selection

The x402 client selects payment options with this priority:

1. If `setPreferredNetwork()` was called, use that network if available
2. Otherwise, prefer `direct` scheme over `exact`
3. Fall back to first available option

```typescript
const client = new x402Client((_version, accepts) => {
  if (preferredNetwork) {
    const preferred = accepts.find((r) => r.network === preferredNetwork);
    if (preferred) return preferred;
  }
  const direct = accepts.find((r) => r.scheme === "direct");
  return direct || accepts[0];
});
```

## Replay Protection

- **Lock-based**: Each `lockId` is a random `bytes32` — used exactly once
- **Map-based dedup**: The facilitator's `claimedLocks` Map (lockId → timestamp) prevents double-claiming, with periodic sweep of entries older than 30 minutes
- **Preimage TTL**: Server-side `PreimageStore` entries expire after 30 minutes; `consumePreimage()` atomically deletes on first use

## Pricing

Routes are configured with human-readable prices that are converted to atomic USDC amounts:

```typescript
const routes = {
  "/api/provider/weather": {
    accepts: server.multiChainAccepts("$0.001"),  // → 1000 atomic units
    description: "Weather data",
  },
  "/api/provider/markets": {
    accepts: server.multiChainAccepts("$0.01"),   // → 10000 atomic units
    description: "Market data",
  },
  "/api/provider/sentiment": {
    accepts: server.multiChainAccepts("$0.05"),   // → 50000 atomic units
    description: "Sentiment analysis",
  },
};
```

`multiChainAccepts()` generates two payment options (exact/Base, direct/Arc) for a single price point.
