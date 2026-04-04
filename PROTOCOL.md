# Payproof Protocol v1: Atomic Data-for-Payment via HTLC

> The canonical, chain-agnostic protocol specification.
> EVM contracts are an implementation of this spec.

## 1. Core Insight

The HTLC preimage that unlocks payment **is** the AES-256-GCM encryption key for the data.

- The merchant generates a random 32-byte `preimage`
- `hashlock = SHA-256(preimage)` is shared with the agent
- The agent locks funds against the hashlock
- The merchant encrypts data with the preimage as the AES key
- The merchant must reveal the preimage on-chain (via `claim`) to get paid
- The agent reads the revealed preimage and decrypts the data

Neither party can cheat: the merchant only gets paid by revealing the decryption key, and the agent only gets the key after confirming data receipt on-chain.

## 2. State Machine

7 states, 6 transitions:

```
                    timelock expires
         +------------------------------+
         |                              v
Empty --> Locked --> DataPosted --> Refunded
              |          |
              |          | agent confirms
              |          v
              |      Confirmed --> Claimed
              |                    (preimage revealed,
              |                     USDC -> merchant)
              |
              |    dataDeadline expires
              |      DataPosted --> Treasury
              |                    (USDC -> treasury)
```

### State Definitions

| State | Value | Description |
|-------|-------|-------------|
| Empty | 0 | No lock exists for this ID |
| Locked | 1 | Funds escrowed, awaiting merchant data |
| DataPosted | 2 | Merchant posted encrypted data hash |
| Confirmed | 3 | Agent confirmed receipt of encrypted data |
| Claimed | 4 | Merchant claimed payment (preimage revealed) |
| Refunded | 5 | Agent reclaimed funds after timelock expiry |
| Treasury | 6 | Funds sent to neutral treasury (dispute) |

### Transition Table

| # | From | To | Caller | Preconditions | Effects |
|---|------|----|--------|---------------|---------|
| 1 | Empty | Locked | Agent | `amount > 0`, `timelock > now`, valid `recipient` | Token transferred to escrow; lock fields stored |
| 2 | Locked | DataPosted | Merchant | `state == Locked`, `now < timelock`, caller is `recipient` | `dataHash` stored, `dataDeadline = now + CONFIRMATION_WINDOW` |
| 3 | DataPosted | Confirmed | Agent | `state == DataPosted`, `now < dataDeadline`, `receiptHash == dataHash` | `receiptHash` stored |
| 4 | Confirmed | Claimed | Anyone | `state == Confirmed`, `SHA-256(preimage) == hashlock` | Token transferred to `recipient` |
| 5 | Locked | Refunded | Anyone | `state == Locked`, `now >= timelock` | Token returned to `sender` |
| 6 | DataPosted | Treasury | Anyone | `state == DataPosted`, `now >= dataDeadline` | Token sent to `treasury` address |

## 3. Lock Structure

Abstract fields that every implementation MUST store per lock:

| Field | Type | Description |
|-------|------|-------------|
| `sender` | address | Agent who locked funds |
| `recipient` | address | Merchant who receives payment |
| `token` | address | Payment token (USDC) |
| `amount` | uint | Atomic token units locked |
| `hashlock` | bytes32 | `SHA-256(preimage)` |
| `timelock` | timestamp | Unix timestamp after which refund is allowed |
| `dataDeadline` | timestamp | Unix timestamp after which treasury sweep is allowed |
| `dataHash` | bytes32 | `SHA-256(ciphertext)` committed by merchant |
| `receiptHash` | bytes32 | `SHA-256(ciphertext)` confirmed by agent |
| `state` | enum | One of the 7 states above |

## 4. Operations

### 4.1 `lock(lockId, recipient, token, amount, hashlock, timelock)`

**Caller:** Agent
**Preconditions:**
- `lockId` does not already exist (state == Empty)
- `amount > 0`
- `timelock > block.timestamp`
- `recipient` is a valid, non-zero address

**Effects:**
- Transfer `amount` of `token` from sender to escrow
- Store all lock fields
- Set `state = Locked`
- Emit `Locked` event

### 4.2 `postDataHash(lockId, dataHash)`

**Caller:** Merchant (must be `lock.recipient`)
**Preconditions:**
- `state == Locked`
- `block.timestamp < timelock`

**Effects:**
- Store `dataHash`
- Set `dataDeadline = block.timestamp + CONFIRMATION_WINDOW`
- Set `state = DataPosted`
- Emit `DataPosted` event

### 4.3 `confirmReceipt(lockId, receiptHash)`

**Caller:** Agent (must be `lock.sender`)
**Preconditions:**
- `state == DataPosted`
- `block.timestamp < dataDeadline`
- `receiptHash == dataHash`

**Effects:**
- Store `receiptHash`
- Set `state = Confirmed`
- Emit `ReceiptConfirmed` event

### 4.4 `claim(lockId, preimage)`

**Caller:** Anyone (typically merchant)
**Preconditions:**
- `state == Confirmed`
- `SHA-256(preimage) == hashlock`

**Effects:**
- Transfer `amount` of `token` from escrow to `recipient`
- Set `state = Claimed`
- Emit `Claimed(lockId, preimage)` event (preimage now public)

### 4.5 `refund(lockId)`

**Caller:** Anyone (typically agent)
**Preconditions:**
- `state == Locked`
- `block.timestamp >= timelock`

**Effects:**
- Transfer `amount` of `token` from escrow to `sender`
- Set `state = Refunded`
- Emit `Refunded` event

### 4.6 `sendToTreasury(lockId)`

**Caller:** Anyone
**Preconditions:**
- `state == DataPosted`
- `block.timestamp >= dataDeadline`

**Effects:**
- Transfer `amount` of `token` from escrow to `treasury`
- Set `state = Treasury`
- Emit `SentToTreasury` event

## 5. Timelocks

| Timelock | Default Duration | Set When | Purpose |
|----------|-----------------|----------|---------|
| `timelock` | 300s (5 min) | `lock()` called | Overall deadline - agent can refund if merchant never responds |
| `dataDeadline` | `block.timestamp + 120s` | `postDataHash()` called | Confirmation window - agent must confirm or funds go to treasury |

The `CONFIRMATION_WINDOW` constant (120s) is added to the current block timestamp when the merchant posts the data hash.

## 6. Cryptography

### SHA-256 Hashlocks (Cross-Chain)

SHA-256 is used (not keccak256) for cross-chain compatibility.

- **Hashlock:** `SHA-256(preimage)` - HTLC commitment
- **dataHash:** `SHA-256(ciphertext_bytes)` - data commitment
- **receiptHash:** Agent re-computes `SHA-256(ciphertext_bytes)` to confirm receipt

### AES-256-GCM Encryption

- **Key:** HTLC preimage (32 bytes / 256 bits)
- **Nonce/IV:** Cryptographically random (12 bytes)
- **Auth tag:** 128 bits (16 bytes) - integrity verification
- **Ciphertext:** Variable length, same as plaintext

The preimage is generated server-side via `crypto.getRandomValues(new Uint8Array(32))`.

### EncryptedPayload Format

```
{
  encryptedBlob: string   // base64-encoded ciphertext
  nonce: string           // hex (12 bytes = 24 hex chars)
  authTag: string         // hex (16 bytes = 32 hex chars)
  dataHash: string        // 0x-prefixed SHA-256 of ciphertext bytes
}
```

## 7. Game Theory

| Scenario | Merchant Action | Agent Action | Outcome |
|----------|----------------|--------------|---------|
| **Happy path** | Posts dataHash, claims after confirmation | Confirms receipt | Merchant gets USDC, agent gets data |
| **Merchant ghosts** | Never posts dataHash | Waits for timelock | Agent refunds after 300s |
| **Agent silent** | Posts dataHash | Never confirms | Treasury gets USDC after dataDeadline |
| **Fake hash** | Posts wrong dataHash | SHA-256 mismatch, confirmReceipt reverts | Agent does not confirm, treasury gets USDC |
| **Garbage data** | Posts correct hash of garbage ciphertext | Agent can verify decrypted data quality | Agent may choose not to confirm, treasury gets USDC |

### Cooperation Incentives

- **Merchant** is incentivized to deliver real data because they only get paid if the agent confirms receipt
- **Agent** is incentivized to confirm receipt because non-confirmation sends funds to treasury (not back to agent)
- **Neither party** can profit by defecting - at worst, disputed funds go to a neutral treasury

### Treasury as Neutral Resolution

The treasury address is set at contract deployment (immutable). When a dispute is unresolvable - merchant posted data but agent didn't confirm - funds go to treasury rather than either party. This eliminates the incentive for strategic non-confirmation.

## 8. Implementation Requirements

Any conforming implementation MUST satisfy:

### State Machine Conformance
- [ ] All 7 states represented
- [ ] All 6 transitions implemented with correct preconditions
- [ ] No additional state transitions exist
- [ ] State can only move forward (no reversal except via refund from Locked)

### Lock Storage
- [ ] All 10 lock fields stored and readable
- [ ] `lockId` is unique per lock (32 bytes)
- [ ] Lock data is publicly readable (for cross-party verification)

### Cryptographic Requirements
- [ ] SHA-256 used for hashlock verification (not chain-native hash)
- [ ] 32-byte preimages supported
- [ ] `claim` emits the preimage in an event/log (publicly readable)

### Token Handling
- [ ] Tokens transferred to escrow on `lock` (not held by sender)
- [ ] Tokens transferred out of escrow on `claim`, `refund`, or `sendToTreasury`
- [ ] No token amounts lost or created during the protocol

### Timelock Enforcement
- [ ] `refund` only succeeds after `timelock` expiry
- [ ] `postDataHash` only succeeds before `timelock` expiry
- [ ] `confirmReceipt` only succeeds before `dataDeadline` expiry
- [ ] `sendToTreasury` only succeeds after `dataDeadline` expiry

### Access Control
- [ ] `postDataHash` restricted to `recipient`
- [ ] `confirmReceipt` restricted to `sender`
- [ ] `claim`, `refund`, `sendToTreasury` callable by anyone (permissionless cranks)

## 9. Implementations

| Chain | Contract | Language | Size | Address |
|-------|----------|----------|------|---------|
| EVM (Arc Testnet) | `HTLC.sol` | Solidity | ~102 lines | Deployed per `HTLC_CONTRACT_ADDRESS` env |

The EVM implementation passes the conformance checklist above and uses `IERC20.transferFrom` for escrow.

### Registry (EVM only)

The `PayproofRegistry` contract maps protocol versions to HTLC contract addresses:

```
getVersion(version) -> { contractAddress, active, deployedAt }
getLatestVersion() -> (version, address)
```

This enables protocol upgrades without breaking existing locks.
