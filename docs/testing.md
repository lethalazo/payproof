# Testing Guide

## Prerequisites

1. **Build all packages** before running tests:
   ```bash
   pnpm install
   pnpm -r build
   ```

2. **Environment variables**: Tests load from `apps/marketplace/.env.local`. Required vars:
   - `AGENT_PRIVATE_KEY`
   - `MERCHANT_ADDRESS`, `MERCHANT_PRIVATE_KEY`
   - `HTLC_CONTRACT_ADDRESS`

3. **Funded wallets**: Agent and merchant wallets need USDC on Arc Testnet. See [Deployment Guide](deployment.md#wallet-funding).

## Install Test Dependencies

```bash
pnpm install   # vitest and dotenv are in root devDependencies
```

## Run Commands

```bash
# All tests (sequential)
pnpm test

# Individual suites
pnpm test:unit          # Unit tests — no network calls, fast (~5s)
pnpm test:evm           # Arc Testnet HTLC + Registry (~3-10 min)
pnpm test:facilitator   # Facilitator integration (~3-5 min)
pnpm test:e2e           # Full encrypted flow with dev server (~5 min)
```

## Test Structure

```
tests/
├── setup.ts                          # Env loading + validation
├── helpers.ts                        # Shared utilities (accounts, clients)
├── unit/
│   ├── preimage-store.test.ts        # MemoryPreimageStore: generate, retrieve, TTL, consume
│   ├── lock-store.test.ts            # MemoryLockStore: add, get, updateStatus, getAll
│   ├── ledger-store.test.ts          # MemoryLedgerStore: record, ordering, revenue summary
│   ├── encryption.test.ts            # encrypt→decrypt round-trip, wrong key, SHA-256 consistency
│   └── parse-price.test.ts           # DirectTransferServer.parsePrice: "$0.001"→1000, etc.
├── evm/
│   ├── htlc-arc.test.ts              # Arc HTLC: lock, getLock, postDataHash, confirmReceipt, claim, refund, full happy path
│   └── registry.test.ts              # PayproofRegistry: getVersion, getLatestVersion
├── facilitator/
│   └── facilitator-arc.test.ts       # DirectTransferFacilitator: verify (positive/wrong amount/wrong recipient), postDataHash, claimAfterConfirmation
└── e2e/
    └── encrypted-flow.test.ts        # Full flow: 402→lock→pay→encrypted response→confirm→claim→decrypt
```

## Execution Model

- **Sequential**: All tests run in a single fork (`singleFork: true` in vitest config) to prevent EVM nonce conflicts.
- **Unique lockIds**: Each test generates a fresh random lockId to avoid collisions.
- **Real testnets**: EVM, facilitator, and E2E tests hit actual testnets — no mocking.

## Timeout Table

| Suite | Per-test Timeout | Notes |
|-------|-----------------|-------|
| Unit | 5s (default) | No network calls |
| EVM HTLC | 60-300s | On-chain transactions on Arc Testnet |
| EVM Registry | 30s | Read-only contract calls |
| Facilitator | 60-180s | claimAfterConfirmation polls for 3 min max |
| E2E | 300s | Spawns dev server + full payment flow |

## Test Details

### Unit Tests (`tests/unit/`)

No network calls. Test pure business logic:

- **preimage-store**: SHA-256(preimage) == hashlock, 50ms TTL expiry, consume removes entry
- **lock-store**: CRUD operations, status filter on getAll
- **ledger-store**: Reverse chronological order, revenue aggregation by chain
- **encryption**: Server encrypt → client decrypt round-trip, wrong key throws, SHA-256 consistency between packages
- **parse-price**: Dollar string → micro-USDC conversion, AssetAmount passthrough, unsupported network throws

### EVM Tests (`tests/evm/`)

Real Arc Testnet transactions:

- **htlc-arc**: Tests all 7 state transitions. The `beforeAll` hook ensures the agent has approved the HTLC contract to spend USDC. Each test creates a fresh lock, exercises one or more state transitions, and reads the final state on-chain.
- **registry**: Reads PayproofRegistry to verify the HTLC address is registered at version 1.

### Facilitator Tests (`tests/facilitator/`)

Tests `DirectTransferFacilitator` with real on-chain state:

- Instantiates a real facilitator with env-based config
- `verify()` reads actual lock state from Arc Testnet
- `postDataHash()` sends a real transaction
- `claimAfterConfirmation()` runs the full async claim loop: starts polling, agent confirms receipt on-chain, facilitator detects confirmation and claims with preimage

### E2E Tests (`tests/e2e/`)

Full encrypted payment flow:

1. Spawns a Next.js dev server on port 3001
2. Makes unauthenticated request → 402
3. Parses payment requirements from 402 response
4. Agent locks USDC on Arc with extracted hashlock
5. Retries with `X-PAYMENT` header containing lockId
6. Receives `EncryptedPayload` response with `x-payproof-encrypted: true`
7. Computes SHA-256(ciphertext) to get receiptHash
8. Calls `confirmReceipt` on-chain
9. Polls for `Claimed` state (merchant claims in background)
10. Extracts preimage from Claimed event logs
11. Decrypts with preimage, verifies plaintext is valid JSON

## Known Limitations

- **sendToTreasury**: Requires ProgramConfig to be initialized. If not initialized, the test logs a warning and skips.
- **E2E server startup**: The dev server can take 30-60s to start. The test waits up to 90s.
- **Nonce conflicts**: Tests run sequentially to prevent EVM nonce conflicts between concurrent transactions from the same wallet.

## How to Add New Tests

1. Create a `.test.ts` file in the appropriate directory (`unit/`, `evm/`, etc.)
2. Import helpers from `../helpers.js` for accounts, clients, and PDA derivation
3. Use `randomBytes(32)` for unique lockIds
4. Set appropriate timeouts via the third argument to `it()` or `describe()`
5. For on-chain tests, always await transaction confirmation before reading state

Example:

```typescript
import { describe, it, expect } from "vitest";
import { randomBytes } from "crypto";
import { readArcLock, ... } from "../helpers.js";

describe("My new test", () => {
  it("does something on-chain", async () => {
    const lockId = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
    // ... create lock, verify state ...
    const lock = await readArcLock(lockId);
    expect(lock.state).toBe(1);
  }, 60_000); // 60s timeout
});
```
