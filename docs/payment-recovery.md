# Payment Recovery

## Failure Modes

The 7-state HTLC protocol has well-defined recovery paths for every failure scenario.

### 1. Merchant Never Posts dataHash

**State**: Lock stays `Locked`
**Recovery**: Agent calls `refund()` after timelock expires (300s)

The merchant received the request but never responded - server crash, deliberate ghosting, or network failure. The lock remains in `Locked` state, and the timelock guarantees the agent can recover funds.

### 2. Agent Never Confirms Receipt

**State**: Lock stays `DataPosted`
**Recovery**: Anyone calls `sendToTreasury()` after dataDeadline expires (120s from data post)

The merchant posted data and committed the dataHash on-chain, but the agent didn't confirm. This could be a client crash, network failure, or deliberate non-confirmation. Funds go to the neutral treasury - the merchant doesn't get paid, but the agent doesn't get a free refund either.

### 3. postDataHash Transaction Fails

**State**: Lock stays `Locked`
**Recovery**: Server retries the transaction; agent refunds after timelock if unresolved

The merchant has the encrypted data ready but the on-chain transaction reverted or timed out. The middleware returns an error to the client. The agent's funds remain safely locked and will be refundable after the timelock.

### 4. confirmReceipt Transaction Fails

**State**: Lock stays `DataPosted`
**Recovery**: Client SDK retries with gas estimation; treasury fallback after dataDeadline

The agent received the encrypted data and computed the receiptHash but the on-chain confirmation failed (gas issues, network congestion). The SDK retries. If confirmation never succeeds, funds go to treasury after the dataDeadline. The agent still has the encrypted payload persisted in `LockStore` for later decryption if the preimage is revealed.

### 5. Agent Misses Claimed Event

**State**: Lock transitions to `Claimed` but agent didn't observe it
**Recovery**: Preimage permanently on-chain in event logs; `LockStore` persists `EncryptedPayload`

The merchant successfully claimed (revealing the preimage), but the agent's `watchForClaim()` timed out or the connection dropped. The preimage is permanently available in the `Claimed` event logs on-chain. The agent can replay event logs later and decrypt using the persisted `EncryptedPayload`.

### 6. Client Disconnects Mid-Flow

**State**: Depends on when disconnect occurs
**Recovery**: `AbortSignal` detection on server; lock remains for refund

The `createNextMiddleware` wraps each request in `runWithRequestContext({ signal: req.signal })`. If the client disconnects:
- **Before lock verification**: No on-chain state changes, nothing to recover
- **After verification, before postDataHash**: Lock stays `Locked`, agent refunds after timelock
- **After postDataHash**: Lock is `DataPosted`, treasury fallback applies
- **After EncryptedPayload sent**: Normal flow continues - agent may or may not confirm

## Defense Layers

### Layer 1: On-Chain State Machine

The HTLC contract provides cryptographic guarantees:
- Funds cannot be double-spent (each state transition is exclusive)
- Timelock ensures bounded commitment (300s max)
- Treasury ensures no party profits from strategic non-cooperation
- Preimage verification ensures the merchant can only claim with the real key

### Layer 2: SDK Safety Checks & Retry Logic

The client and server SDKs handle transient failures:
- **Timelock margin**: `verify()` rejects locks with < 120s remaining; `postDataHash()` re-checks before submitting to prevent race conditions where time elapsed between verification and posting
- **Gas estimation**: HTLC client estimates gas before submitting transactions
- **Event polling**: `watchForClaim` polls with 2-second intervals for up to 4 minutes
- **Background claim polling**: `claimAfterConfirmation` polls with 3-second intervals for up to 3 minutes

### Layer 3: Client-Side LockStore

The `LockStore` persists lock state and encrypted payloads:

```typescript
interface PendingLock {
  lockId: string;
  network: string;
  amount: string;
  timelock: number;
  createdAt: number;
  status: "locked" | "settled" | "refunded" | "claimed_by_server";
  encryptedPayload?: EncryptedPayload;  // persisted for retry
}
```

This enables:
- **Offline decryption retry**: If the agent has the encrypted payload and later discovers the preimage (from on-chain events), it can decrypt without re-requesting the data
- **Lock status tracking**: Agent tools (`check_pending_payments`) can query on-chain state for all locks
- **Refund automation**: `refund_expired_lock` tool checks timelock expiry and submits refund transactions

## Timing Diagram

```
Time 0s        lock() called
  │
  │ ─────── Normal flow (< 30s typical) ──────
  │
  │  ~5s    verify + encrypt + postDataHash
  │  ~10s   EncryptedPayload returned to agent
  │  ~15s   confirmReceipt on-chain
  │  ~20s   claim on-chain (preimage revealed)
  │  ~25s   agent decrypts, done
  │
  │ ─────── Failure boundaries ───────────────
  │
120s+        dataDeadline expires
  │          (if DataPosted but not Confirmed)
  │          → sendToTreasury() available
  │
300s         timelock expires
  │          (if still Locked)
  │          → refund() available
  │
```

### Two-Timelock System

| Timer | Duration | Starts at | Protects |
|-------|----------|-----------|----------|
| **timelock** | 300s (5 min) | `lock()` | Agent - can refund if merchant never responds |
| **dataDeadline** | +120s (2 min) | `postDataHash()` | Merchant - if agent ghosts, treasury gets funds (not agent) |

The 120-second confirmation window (`CONFIRMATION_WINDOW` constant) starts when the merchant posts the dataHash. This gives the agent time to verify the encrypted data, compute the receiptHash, and submit the `confirmReceipt` transaction.

## Treasury as Safety Net

The treasury address is set at contract deployment and is immutable. It serves as a neutral dispute resolution mechanism:

- **Neither party benefits from defection**: If the merchant posts data but the agent doesn't confirm, funds go to treasury - not back to the agent
- **No incentive for strategic non-confirmation**: The agent can't get a free refund after receiving data
- **Bounded loss**: The merchant loses the sale but doesn't subsidize the agent
- **Transparent**: Treasury transactions are on-chain and auditable

## Agent Recovery Tools

The reference app provides two agent tools for payment recovery:

### `check_pending_payments`

Queries on-chain state for all HTLC locks created in the current session. Returns:
- `onChainState`: Current state from the contract (Empty, Locked, DataPosted, Confirmed, Claimed, Refunded, Treasury)
- `refundable`: Whether the lock can be refunded now (Locked + timelock expired)
- `timelockExpiry`: When the refund window opens
- `timelockExpired`: Whether the timelock has already passed

### `refund_expired_lock`

Submits a refund transaction for an expired lock:
- Verifies the lock is in `Locked` state on-chain
- Verifies the timelock has expired
- Calls `refund()` on the HTLC contract
- Updates the `LockStore` status to `"refunded"`
