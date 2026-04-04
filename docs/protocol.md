# Payproof Protocol Specification

> Atomic data-for-payment via HTLC + AES-256-GCM encryption. Protocol version 1.

## Overview

Payproof enables trustless machine-to-machine data purchases. An AI agent pays for data, and a merchant delivers it — atomically. Neither party can cheat.

**Key insight**: The HTLC preimage that unlocks payment **is** the AES-256-GCM encryption key for the data. The merchant can only get paid by revealing the decryption key on-chain. The agent can only decrypt the data after confirming receipt on-chain.

## 14-Step Protocol Flow

```
Agent                          Merchant                        Blockchain
  │                               │                                │
  │  1. GET /data                 │                                │
  │──────────────────────────────>│                                │
  │                               │                                │
  │  2. HTTP 402 + requirements   │                                │
  │  (hashlock, htlcContract,     │                                │
  │   amount, protocolVersion)    │                                │
  │<──────────────────────────────│                                │
  │                               │                                │
  │  3. lock(lockId, recipient,   │                                │
  │     token, amount, hashlock,  │                                │
  │     timelock)                 │                                │
  │──────────────────────────────────────────────────────────────>│
  │                               │               4. State: Locked │
  │                               │                                │
  │  5. Retry GET /data           │                                │
  │  + X-PAYMENT header {lockId}  │                                │
  │──────────────────────────────>│                                │
  │                               │  6. verify() — read lock       │
  │                               │     on-chain, check recipient, │
  │                               │     amount, hashlock, timelock │
  │                               │───────────────────────────────>│
  │                               │                                │
  │                               │  7. Fetch data from route      │
  │                               │     handler (plaintext)        │
  │                               │                                │
  │                               │  8. Encrypt:                   │
  │                               │     key = preimage (32 bytes)  │
  │                               │     nonce = random (12 bytes)  │
  │                               │     ciphertext, authTag =      │
  │                               │       AES-256-GCM(plaintext)   │
  │                               │     dataHash = SHA-256(cipher) │
  │                               │                                │
  │                               │  9. postDataHash(lockId,       │
  │                               │     dataHash) — on-chain tx    │
  │                               │───────────────────────────────>│
  │                               │         10. State: DataPosted  │
  │                               │             dataDeadline set   │
  │                               │                                │
  │  11. HTTP 200 EncryptedPayload│                                │
  │  {encryptedBlob, nonce,       │                                │
  │   authTag, dataHash}          │                                │
  │<──────────────────────────────│                                │
  │                               │                                │
  │  12. receiptHash =            │                                │
  │      SHA-256(ciphertext)      │                                │
  │      confirmReceipt(lockId,   │                                │
  │        receiptHash)           │                                │
  │──────────────────────────────────────────────────────────────>│
  │                               │          13. State: Confirmed  │
  │                               │                                │
  │                               │  14. claim(lockId, preimage)   │
  │                               │      → preimage on-chain       │
  │                               │───────────────────────────────>│
  │                               │            State: Claimed      │
  │                               │            USDC → merchant     │
  │                               │                                │
  │  Agent reads Claimed event    │                                │
  │  extracts preimage            │                                │
  │  decrypts data with preimage  │                                │
  │                               │                                │
```

### SDK Abstraction

From the developer's perspective:

**Agent** — calls `fetch(url)`, gets plaintext response. Steps 1-5 and 11-14 are invisible.

**Merchant** — returns data from route handler. Steps 6-10 and 14 are handled by middleware.

```typescript
// Agent: one line
const response = await fetchWithPayment("https://api.example.com/weather");
const data = await response.json(); // plaintext, fully decrypted

// Merchant: three lines of config
const server = createPayproofServer({ merchantEvmAddress, merchantEvmPrivateKey, htlcContractAddress });
const middleware = createNextMiddleware(server, routes);
// Route handlers return data normally — encryption is automatic
```

## State Machine

7 states, 6 transitions:

```
                    timelock expires
         ┌──────────────────────────────┐
         │                              ▼
Empty ──> Locked ──> DataPosted ──> Refunded (impossible*)
              │           │
              │           │  agent confirms
              │           ▼
              │       Confirmed ──> Claimed
              │                     (preimage revealed,
              │                      USDC → merchant)
              │
              │      dataDeadline expires
              │       DataPosted ──> Treasury
              │                      (USDC → treasury)
```

*\*Refund is only possible from Locked state, not from DataPosted.*

### Transition Table

| From | To | Who | Condition | Effect |
|------|-----|-----|-----------|--------|
| Empty | Locked | Agent | `amount > 0`, `timelock > now`, valid recipient | USDC transferred to contract escrow |
| Locked | DataPosted | Merchant | `state == Locked`, `now < timelock`, caller is recipient | `dataHash` stored, `dataDeadline = now + 120s` |
| DataPosted | Confirmed | Agent | `state == DataPosted`, `now < dataDeadline`, `receiptHash == dataHash` | `receiptHash` stored |
| Confirmed | Claimed | Anyone | `state == Confirmed`, `SHA-256(preimage) == hashlock` | USDC transferred to merchant |
| Locked | Refunded | Anyone | `state == Locked`, `now >= timelock` | USDC returned to agent |
| DataPosted | Treasury | Anyone | `state == DataPosted`, `now >= dataDeadline` | USDC sent to treasury |

## Two Timelocks

| Timelock | Duration | Set when | Purpose |
|----------|----------|----------|---------|
| `timelock` | 300s (5 min) | `lock()` called | Overall deadline — agent can refund if merchant never responds |
| `dataDeadline` | `block.timestamp + 120s` | `postDataHash()` called | Confirmation window — agent must confirm receipt within 120s or funds go to treasury |

The `CONFIRMATION_WINDOW` constant (120s) is added to the current block timestamp when the merchant posts the data hash. This gives the agent time to verify the encrypted data and confirm receipt.

## Game Theory Analysis

| Scenario | Merchant Action | Agent Action | Outcome |
|----------|----------------|--------------|---------|
| **Happy path** | Posts dataHash, claims after confirmation | Confirms receipt | Merchant gets USDC, agent gets data |
| **Merchant ghosts** | Never posts dataHash | Waits for timelock | Agent refunds after 300s |
| **Agent silent** | Posts dataHash | Never confirms | Treasury gets USDC after dataDeadline (120s) |
| **Fake hash** | Posts wrong dataHash | SHA-256 mismatch → confirmReceipt reverts | Agent does not confirm, treasury gets USDC |
| **Garbage data** | Posts correct hash of garbage ciphertext | Agent can verify decrypted data quality | Agent may choose not to confirm → treasury |

**Key properties**:
- No party can profit by cheating — at worst, disputed funds go to a neutral treasury
- The merchant must reveal the preimage (encryption key) to get paid
- The agent must confirm data receipt before the merchant can claim
- Both parties have a bounded time commitment (5 minutes max)

## Treasury Mechanism

The treasury address is a neutral third party set at contract deployment (immutable). When a dispute is unresolvable — merchant posted data but agent didn't confirm — the funds go to treasury rather than either party. This eliminates the incentive for strategic non-confirmation by the agent.

## Cryptographic Details

### AES-256-GCM Encryption

- **Key**: HTLC preimage (32 bytes / 256 bits)
- **Nonce/IV**: Cryptographically random (12 bytes)
- **Auth tag**: 128 bits (16 bytes) — integrity verification
- **Ciphertext**: Variable length, same as plaintext

The preimage is generated server-side via `crypto.getRandomValues(new Uint8Array(32))`.

### SHA-256 Hashing

- **Hashlock**: `SHA-256(preimage)` — used for HTLC verification
- **dataHash**: `SHA-256(ciphertext_bytes)` — commitment to encrypted data
- **receiptHash**: Agent re-computes `SHA-256(ciphertext_bytes)` to confirm receipt

SHA-256 is used (not keccak256) for cross-chain compatibility between EVM and Solana.

### EncryptedPayload Format

```typescript
interface EncryptedPayload {
  encryptedBlob: string;  // base64-encoded ciphertext
  nonce: string;          // hex (12 bytes = 24 hex chars)
  authTag: string;        // hex (16 bytes = 32 hex chars)
  dataHash: string;       // 0x-prefixed SHA-256 of ciphertext bytes
}
```

## Transport Flow

The protocol rides on HTTP, using the [x402](https://www.x402.org/) standard for payment negotiation:

1. **Initial request** — Agent sends `GET /api/provider/weather`
2. **402 response** — Server returns `HTTP 402 Payment Required` with `PaymentRequirements` including:
   - `scheme: "direct"` — HTLC payment
   - `network: "eip155:5042002"` — Arc Testnet (or `solana:devnet`)
   - `amount` — USDC in atomic units (e.g., `"1000"` = $0.001)
   - `extra.hashlock` — SHA-256 of server-generated preimage
   - `extra.htlcContract` — HTLC contract address
   - `extra.timelockSeconds` — 300
   - `extra.protocolVersion` — 1
3. **Lock** — Agent locks funds on-chain using the provided hashlock
4. **Retry** — Agent re-sends request with `X-PAYMENT` header containing `{ lockId, network, hashlock }`
5. **Encrypted response** — Server returns `HTTP 200` with `x-payproof-encrypted: true` header and `EncryptedPayload` body
6. **On-chain confirmation + claim + decrypt** — handled asynchronously by SDK

## Protocol Versioning

The `PayproofRegistry` contract (EVM only) maps protocol versions to HTLC contract addresses:

```typescript
// Registry maps version → { contractAddress, active, deployedAt }
const REGISTRY_ABI = parseAbi([
  "function getVersion(uint256 version) view returns ((address contractAddress, bool active, uint256 deployedAt))",
  "function getLatestVersion() view returns (uint256, address)",
  "function latestVersion() view returns (uint256)",
]);
```

The server includes `extra.protocolVersion` in the 402 response. The client SDK checks version compatibility before locking funds.

## Edge Cases & Mitigations

| Scenario | Risk | Mitigation |
|----------|------|------------|
| `postDataHash` tx fails | Lock stays in `Locked` state | Server retries tx; agent refunds after timelock if unresolved |
| `confirmReceipt` tx fails | Lock stays in `DataPosted` state | Client SDK retries with gas estimation; treasury fallback after deadline |
| Agent misses `Claimed` event | Agent has ciphertext but no preimage | Preimage permanently on-chain in event logs; `LockStore` persists `EncryptedPayload` for offline retry |
| Client disconnects mid-flow | Lock created but response never received | `AbortSignal` detection on server; lock remains for agent refund after timelock |
| Gas spike during claim | Merchant claim tx may be delayed or fail | Fire-and-forget with retry; agent refund is the safety net |
| Preimage store TTL expires | Server can't find preimage for claim | 30-minute TTL exceeds typical flow (~30s); preimage is consumed (deleted) during encryption and passed explicitly to claim |
| Stale 402 requirements | Hashlock mismatch on retry | Preimage expired or consumed; client gets fresh requirements on next attempt |
