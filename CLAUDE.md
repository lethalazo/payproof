# Payproof

> **Documentation-Driven Development**: A task is NOT done until docs are updated.

## What This Is

Payproof is an **atomic data-for-payment protocol** for AI agent commerce. Built on the x402 HTTP standard with HTLC smart contracts.

**Core innovation**: The HTLC preimage that unlocks payment **is** the AES-256-GCM decryption key for the data. Neither party can cheat - the merchant only gets paid by revealing the decryption key, and the agent only gets the key after confirming data receipt on-chain.

**Status**: MVP complete, production ready

## Dev Commands

```bash
# Install & build
pnpm install
pnpm -r build

# Run reference marketplace app
cp apps/marketplace/.env.example apps/marketplace/.env.local  # Fill in keys
pnpm dev                    # Next.js on localhost:3000

# Tests
pnpm test                   # All tests (sequential)
pnpm test:unit              # Unit tests (~5s, no network)
pnpm test:evm               # Arc Testnet HTLC (3-10 min)
pnpm test:facilitator       # Facilitator integration (3-5 min)
pnpm test:solana            # Solana HTLC tests (3-10 min)
pnpm test:e2e               # Full encrypted flow (5 min)

# Clean
pnpm -r clean
```

## Architecture

### Monorepo Structure

```
packages/
  contracts/               # @payproof/contracts - types, ABIs, chain configs
  client/                  # @payproof/client - agent-side SDK
    src/
      client.ts              # createPayproofClient() factory
      x402/                  # x402 integration + encrypted response handling
      evm/                   # Arc wallet + HTLC client (lock, confirm, watch)
      solana/                # Solana wallet + HTLC client
      crypto/                # AES-256-GCM decryption
      stores/                # LockStore - pending payment tracking
      auto-refund.ts         # Background refund sweeper
  server/                  # @payproof/server - merchant-side SDK
    src/
      gate.ts                # createPayproofServer() factory
      facilitator.ts         # verify, postDataHash, claimAfterConfirmation
      crypto/                # AES-256-GCM encryption
      stores/                # PreimageStore, LedgerStore
      adapters/next.ts       # createNextMiddleware()

apps/marketplace/          # Reference Next.js app with AI agent loop

contracts/HTLC.sol         # 7-state EVM HTLC contract (Solidity)
programs/htlc-solana/      # Solana HTLC program (Anchor)
```

## Multi-Chain Support

| Chain | Scheme | Token | Status |
|-------|--------|-------|--------|
| **Arc Testnet** | `direct` (HTLC) | USDC | Primary - full atomic protocol |
| **Base Sepolia** | `exact` (Permit2) | USDC | x402 compatibility - trust-based |
| **Solana Devnet** | `direct` (HTLC) | USDC | SDK-level, not enabled in demo |

## 7-State HTLC Protocol

```
Empty → Locked → DataPosted → Confirmed → Claimed
                      ↓
                   Treasury (deadline expired)
Locked → Refunded (timelock expired)
```

| State | Transition | Who | What Happens |
|-------|-----------|-----|-------------|
| Empty → Locked | `lock()` | Agent | USDC escrowed |
| Locked → DataPosted | `postDataHash()` | Merchant | Data hash committed, 120s deadline starts |
| DataPosted → Confirmed | `confirmReceipt()` | Agent | Agent confirms data hash matches |
| Confirmed → Claimed | `claim(preimage)` | Anyone | Preimage revealed, USDC released to merchant |
| Locked → Refunded | `refund()` | Anyone | Timelock expired, USDC returned |
| DataPosted → Treasury | `sendToTreasury()` | Anyone | Deadline expired, USDC to treasury |

**Timelocks**: lock() → 300s (merchant posts data), postDataHash() → +120s (agent confirms)

## Key Patterns

- **Factory pattern**: `createPayproofClient()` and `createPayproofServer()` - modular per-chain config
- **Preimage-as-key**: 32-byte HTLC preimage = AES-256-GCM encryption key. Atomic by construction
- **Pluggable stores**: PreimageStore, LockStore, LedgerStore - all have Memory* implementations, swap for Redis/PG in production
- **x402 transport**: HTTP 402 standard. Two schemes: `direct` (atomic HTLC) and `exact` (Permit2, trust-based)
- **Next.js middleware**: `createNextMiddleware()` orchestrates full encrypted flow transparently
- **Auto-refund sweeper**: Background service refunds expired locks (configurable interval)
- **SHA-256 everywhere**: Cross-chain compatible hashlocks (NOT keccak256)

## Critical Rules

1. **State machine integrity**: 7 distinct states, no intermediate states. Never skip states
2. **SHA-256 for hashlocks**: Cross-chain compatibility requirement. Never use keccak256
3. **All tests must pass** before merging. Run `pnpm test` (sequential to prevent nonce conflicts)
4. **Preimage TTL**: Default 30 min in PreimageStore. Expired preimages return null
5. **Minimum timelock safety**: Server aborts if `now + 120s > timelock`
6. **Lock ID uniqueness**: 32-byte random per payment attempt

## Code Style

- TypeScript strict mode, ESM (`type: "module"`)
- Target ES2020 (Node 18+)
- Named exports only (no default exports)
- `.js` extensions in imports (ESM requirement)
- camelCase functions, PascalCase types, UPPER_SNAKE_CASE constants
- Files: lowercase with hyphens (e.g., `x402-direct-client.ts`)
- Factories return configured interfaces
- Async throughout for all crypto, on-chain, I/O
- vitest for testing (sequential to prevent nonce conflicts)
- tsup for building packages

## Environment Variables

**Required** (apps/marketplace/.env.local):
```
ANTHROPIC_API_KEY=sk-ant-...
AGENT_PRIVATE_KEY=0x...
MERCHANT_ADDRESS=0x...
MERCHANT_PRIVATE_KEY=...
HTLC_CONTRACT_ADDRESS=0x...
TREASURY_ADDRESS=0x...
```

**Deployed Contracts**:
- Arc Testnet HTLC: `0x6C14aDD48bF2D4D01Df5D98Ab5A7Ac2DcD181bd7`
- Arc Testnet Registry: `0x811A8C492697d3EfbbA754748F34bAF8B59FfCf3`

## Documentation

- `PROTOCOL.md` - Chain-agnostic HTLC spec, state machine, conformance checklist
- `docs/protocol.md` - Full 14-step flow, game theory, cryptographic details
- `docs/architecture.md` - System design, package structure, data flow
- `docs/smart-contracts.md` - HTLC.sol, PayproofRegistry, deployment, ABI
- `docs/payment-system.md` - x402 schemes, encrypted flow, preimage lifecycle
- `docs/payment-recovery.md` - Failure modes, defense layers, treasury mechanism
- `docs/sdk-guide.md` - Merchant + agent integration, configuration, examples
- `docs/api-reference.md` - HTTP endpoints, agent tools, response schemas
- `docs/deployment.md` - Environment setup, contract deployment, key management
- `docs/testing.md` - Test structure, execution model, timeouts
- `docs/competitive-analysis.md` - x402 vs Payproof positioning
- `docs/roadmap.md` - Enhancement roadmap
