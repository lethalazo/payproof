# Smart Contracts

## Overview

Payproof uses an EVM HTLC implementation (Solidity) plus a `PayproofRegistry` contract for version management on EVM.

The HTLC contract implements a 7-state machine with well-defined game-theoretic guarantees. SHA-256 is used for hashlocks (not keccak256).

## State Machine

```
7 States: Empty → Locked → DataPosted → Confirmed → Claimed
                  Locked → Refunded
                  DataPosted → Treasury
```

| State | Value | Meaning |
|-------|-------|---------|
| `Empty` | 0 | No lock exists (default) |
| `Locked` | 1 | Agent has locked USDC in escrow |
| `DataPosted` | 2 | Merchant has posted `dataHash` and `dataDeadline` is set |
| `Confirmed` | 3 | Agent has confirmed receipt (`receiptHash == dataHash`) |
| `Claimed` | 4 | Merchant has claimed USDC by revealing preimage |
| `Refunded` | 5 | Agent has reclaimed USDC after timelock expiry |
| `Treasury` | 6 | Funds sent to treasury after `dataDeadline` expiry |

### State Transition Diagram

```
           ┌────────────────────────────────────────────┐
           │              timelock expires               │
           │              (now >= timelock)               │
           │                                             ▼
Empty ──> Locked ──────────────────────────────────> Refunded
              │
              │  postDataHash (merchant, now < timelock)
              ▼
         DataPosted ────────────────────────────────> Treasury
              │           dataDeadline expires
              │           (now >= dataDeadline)
              │
              │  confirmReceipt (agent, now < dataDeadline,
              │                  receiptHash == dataHash)
              ▼
         Confirmed ─────────────────────────────────> Claimed
                          claim (anyone,
                          SHA-256(preimage) == hashlock)
```

## EVM Contract: HTLC.sol

**Location**: `packages/contracts/contracts/HTLC.sol` (102 lines)

### Lock Struct

```solidity
struct Lock {
    address sender;       // agent who locked funds
    address recipient;    // merchant who receives payment
    address token;        // ERC-20 token (USDC)
    uint256 amount;       // payment amount
    bytes32 hashlock;     // SHA-256(preimage) — set at lock time
    uint256 timelock;     // absolute timestamp — agent can refund after this
    uint256 dataDeadline; // set when postDataHash is called (now + 120s)
    bytes32 dataHash;     // SHA-256(ciphertext) — merchant's commitment
    bytes32 receiptHash;  // agent's confirmation (must match dataHash)
    State state;          // current state (0-6)
}
```

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `CONFIRMATION_WINDOW` | 120 seconds | Time agent has to confirm receipt after merchant posts dataHash |
| `treasury` | Immutable address | Neutral third party for unresolvable disputes |

### Functions

#### `lock(lockId, recipient, token, amount, hashlock, timelock)`
- **Caller**: Agent
- **Preconditions**: `state == Empty`, `amount > 0`, `timelock > now`, valid recipient
- **Effect**: Transfers USDC from agent to contract, creates lock in `Locked` state
- **Emits**: `Locked(lockId, sender, recipient, hashlock, amount, timelock)`

#### `postDataHash(lockId, dataHash)`
- **Caller**: Merchant (must be `recipient`)
- **Preconditions**: `state == Locked`, `now < timelock`
- **Effect**: Sets `dataHash`, sets `dataDeadline = now + 120s`, transitions to `DataPosted`
- **Emits**: `DataPosted(lockId, dataHash, dataDeadline)`

#### `confirmReceipt(lockId, receiptHash)`
- **Caller**: Agent (must be `sender`)
- **Preconditions**: `state == DataPosted`, `now < dataDeadline`, `receiptHash == dataHash`
- **Effect**: Sets `receiptHash`, transitions to `Confirmed`
- **Emits**: `ReceiptConfirmed(lockId, receiptHash)`

#### `claim(lockId, preimage)`
- **Caller**: Anyone (typically merchant)
- **Preconditions**: `state == Confirmed`, `sha256(preimage) == hashlock`
- **Effect**: Transfers USDC to merchant, transitions to `Claimed`
- **Emits**: `Claimed(lockId, preimage)` — preimage is now public on-chain

#### `refund(lockId)`
- **Caller**: Anyone (typically agent)
- **Preconditions**: `state == Locked`, `now >= timelock`
- **Effect**: Returns USDC to agent, transitions to `Refunded`
- **Emits**: `Refunded(lockId)`

#### `sendToTreasury(lockId)`
- **Caller**: Anyone
- **Preconditions**: `state == DataPosted`, `now >= dataDeadline`
- **Effect**: Sends USDC to treasury address, transitions to `Treasury`
- **Emits**: `SentToTreasury(lockId, treasury)`

#### `getLock(lockId)` (view)
- Returns the full `Lock` struct for a given lock ID.

### Events

| Event | Fields | When |
|-------|--------|------|
| `Locked` | `lockId`, `sender`, `recipient`, `hashlock`, `amount`, `timelock` | Agent locks funds |
| `DataPosted` | `lockId`, `dataHash`, `dataDeadline` | Merchant posts data commitment |
| `ReceiptConfirmed` | `lockId`, `receiptHash` | Agent confirms receipt |
| `Claimed` | `lockId`, `preimage` | Merchant claims with preimage |
| `Refunded` | `lockId` | Agent refunds after timelock |
| `SentToTreasury` | `lockId`, `treasury` | Funds sent to treasury after deadline |

### Security Properties

- **No reentrancy**: Checks-effects-interactions pattern — state is updated before token transfers
- **No admin functions**: HTLC has no owner, no pause, no upgrade on the core contract
- **Immutable treasury**: Set in constructor, cannot be changed
- **SHA-256**: Uses `sha256()` precompile, not `keccak256()`

## PayproofRegistry.sol

Version management contract for tracking HTLC deployments across protocol upgrades.

```typescript
const REGISTRY_ABI = parseAbi([
  "function getVersion(uint256 version) view returns ((address contractAddress, bool active, uint256 deployedAt))",
  "function getLatestVersion() view returns (uint256, address)",
  "function latestVersion() view returns (uint256)",
]);
```

### Version Entry

```
{ contractAddress: address, active: bool, deployedAt: uint256 }
```

- **Owner-controlled**: Only the owner can register or deactivate versions
- **One per chain**: Deployed on each EVM chain where Payproof operates
- **Client compatibility**: Clients check `extra.protocolVersion` in the 402 response against the registry

## ABI Reference

### TypeScript ABI Definitions

```typescript
import { parseAbi } from "viem";

export const HTLC_ABI = parseAbi([
  "function lock(bytes32 lockId, address recipient, address token, uint256 amount, bytes32 hashlock, uint256 timelock) external",
  "function postDataHash(bytes32 lockId, bytes32 dataHash) external",
  "function confirmReceipt(bytes32 lockId, bytes32 receiptHash) external",
  "function claim(bytes32 lockId, bytes32 preimage) external",
  "function refund(bytes32 lockId) external",
  "function sendToTreasury(bytes32 lockId) external",
  "function getLock(bytes32 lockId) view returns ((address sender, address recipient, address token, uint256 amount, bytes32 hashlock, uint256 timelock, uint256 dataDeadline, bytes32 dataHash, bytes32 receiptHash, uint8 state))",
  "function treasury() view returns (address)",
  "function CONFIRMATION_WINDOW() view returns (uint256)",
  "event Locked(bytes32 indexed lockId, address indexed sender, address indexed recipient, bytes32 hashlock, uint256 amount, uint256 timelock)",
  "event DataPosted(bytes32 indexed lockId, bytes32 dataHash, uint256 dataDeadline)",
  "event ReceiptConfirmed(bytes32 indexed lockId, bytes32 receiptHash)",
  "event Claimed(bytes32 indexed lockId, bytes32 preimage)",
  "event Refunded(bytes32 indexed lockId)",
  "event SentToTreasury(bytes32 indexed lockId, address treasury)",
]);

export enum LockState {
  Empty = 0,
  Locked = 1,
  DataPosted = 2,
  Confirmed = 3,
  Claimed = 4,
  Refunded = 5,
  Treasury = 6,
}
```

## Deployment

### HTLC.sol (Arc Testnet)

```bash
# Using Foundry — constructor takes treasury address
forge create contracts/HTLC.sol:HTLC \
  --constructor-args <TREASURY_ADDRESS> \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key $DEPLOYER_PRIVATE_KEY
```

After deployment, set `HTLC_CONTRACT_ADDRESS` in your environment. The agent wallet's USDC approval happens automatically on first payment.

### PayproofRegistry (Arc Testnet)

Deploy after HTLC, then register the HTLC address as version 1:

```bash
# Deploy registry
forge create contracts/PayproofRegistry.sol:PayproofRegistry \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key $DEPLOYER_PRIVATE_KEY

# Register HTLC as version 1 (via cast or script)
cast send $REGISTRY_ADDRESS "registerVersion(address)" $HTLC_ADDRESS \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key $DEPLOYER_PRIVATE_KEY
```

