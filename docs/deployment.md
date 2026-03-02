# Deployment Guide

> This covers running the Payproof prototype locally on testnets. For production deployment of `@payproof/server` and `@payproof/client`, see the [SDK Guide](sdk-guide.md).

## Prerequisites

- **Node.js** 18+ and **pnpm** (for monorepo)
- **Rust + Solana CLI** (only if deploying the Solana HTLC program)
- **Foundry/Forge** (only if deploying the EVM HTLC contract)
- Funded wallets on the target testnets

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cd apps/marketplace
cp .env.example .env.local
```

### Required Variables

| Variable | Format | Read By | Description |
|----------|--------|---------|-------------|
| `ANTHROPIC_AUTH_TOKEN` | `sk-ant-...` | Marketplace | Claude API key (or OAuth token) |
| `AGENT_PRIVATE_KEY` | `0x...` hex | Client SDK | Agent's EVM private key (Base Sepolia + Arc) |
| `AGENT_SOLANA_PRIVATE_KEY` | Base58 | Client SDK | Agent's Solana keypair |
| `MERCHANT_ADDRESS` | `0x...` | Server SDK, Client SDK | EVM address that receives payments |
| `MERCHANT_SOL_ADDRESS` | Base58 | Server SDK, Client SDK | Solana address that receives payments |
| `MERCHANT_PRIVATE_KEY` | Hex (no 0x prefix) | Server SDK | Merchant's EVM key (signs HTLC claims on Arc) |
| `MERCHANT_SOLANA_PRIVATE_KEY` | Base58 | Server SDK | Merchant's Solana key (signs HTLC claims on Solana) |
| `HTLC_CONTRACT_ADDRESS` | `0x...` | Server SDK, Client SDK | Deployed HTLC.sol address on Arc Testnet |
| `HTLC_SOLANA_PROGRAM_ID` | Base58 | Server SDK, Client SDK | Deployed Anchor program ID on Solana Devnet |
| `PAYPROOF_REGISTRY_ADDRESS` | `0x...` | Client SDK | PayproofRegistry contract on Arc Testnet |
| `TREASURY_ADDRESS` | `0x...` | HTLC constructor | Treasury address for dispute resolution |

### Optional Variables

| Variable | Default | Read By | Description |
|----------|---------|---------|-------------|
| `SOLANA_USDC_MINT` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | Client/Server SDK | USDC mint on Solana Devnet |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Server SDK | Solana RPC endpoint |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Marketplace | Self-referential URL for internal API calls |
| `PAYPROOF_ENCRYPTED_FLOW` | `false` | Middleware | Enable encrypted data-for-payment mode |

### Deployed Contract Addresses

| Contract | Network | Address |
|----------|---------|---------|
| HTLC (7-state) | Arc Testnet | `0x6C14aDD48bF2D4D01Df5D98Ab5A7Ac2DcD181bd7` |
| PayproofRegistry | Arc Testnet | `0x811A8C492697d3EfbbA754748F34bAF8B59FfCf3` |
| HTLC Solana | Solana Devnet | `GigEY98avKBtVEtJpqytTdSfEaCnULZNuE5Nyx98R7Yh` |
| USDC | Arc Testnet | `0x3600000000000000000000000000000000000000` |
| USDC | Solana Devnet | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| USDC | Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Key Management

The system uses **four separate keys**:

### Agent Keys

These are the AI agent's wallet keys. The agent uses them to:
- Check balances
- Lock USDC in HTLC escrow (paying for data)
- Confirm receipt of encrypted data on-chain
- Refund expired locks

```
AGENT_PRIVATE_KEY       → Derives EVM address used on Base Sepolia + Arc Testnet
AGENT_SOLANA_PRIVATE_KEY → Separate Solana keypair (different address space)
```

The same EVM private key is used for both Base Sepolia and Arc Testnet because they share the same address space.

### Merchant Keys

These are the data provider's wallet keys. The server uses them to:
- Post dataHash on-chain (committing encrypted data)
- Sign HTLC claim transactions (receiving payment by revealing preimage)

```
MERCHANT_PRIVATE_KEY          → Signs postDataHash() and claim() on Arc Testnet
MERCHANT_SOLANA_PRIVATE_KEY   → Signs post_data_hash and claim on Solana Devnet
MERCHANT_ADDRESS              → Receives funds on Base Sepolia + Arc
MERCHANT_SOL_ADDRESS          → Receives funds on Solana
```

The merchant address and the key that signs claims must correspond — the private key should derive the merchant address.

## Wallet Funding

### Base Sepolia

1. Get Base Sepolia ETH from a faucet (for gas)
2. Get USDC from the Base Sepolia USDC faucet or bridge
3. USDC contract: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

### Arc Testnet

1. Get USDC from the Arc Testnet faucet (USDC is the native gas token — no separate gas needed)
2. RPC: `https://rpc.testnet.arc.network`
3. Explorer: `https://testnet.arcscan.app`
4. USDC address: `0x3600000000000000000000000000000000000000`

### Solana Devnet

1. Get SOL from `solana airdrop 2 --url devnet` (for gas)
2. Create a USDC token account and fund it
3. Mint address: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (or your custom devnet mint)

## Build Process

The monorepo build order matters — packages depend on each other:

```bash
# 1. Install all dependencies
pnpm install

# 2. Build in dependency order (contracts → server → client → marketplace)
pnpm -r build
```

Each package uses `tsup` for TypeScript bundling. The build command in each `package.json` runs `tsup src/index.ts --format esm --dts`.

### Solana Program Build

The Solana program is built separately using `cargo build-sbf`:

```bash
# Build with the correct Solana tools version
cargo build-sbf --tools-version v1.52 \
  --manifest-path programs/htlc-solana/Cargo.toml

# Output: target/deploy/htlc_solana.so
```

**Important**: Do NOT use `anchor build` — it may use a different tools version. The `Cargo.toml` has `overflow-checks = true` in the release profile for safety.

## Contract Deployment

### HTLC.sol (Arc Testnet)

The HTLC contract requires a treasury address in its constructor:

```bash
# IMPORTANT: forge ignores --rpc-url if ETH_RPC_URL is set
export ETH_RPC_URL=https://rpc.testnet.arc.network

forge create contracts/HTLC.sol:HTLC \
  --constructor-args $TREASURY_ADDRESS \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key $DEPLOYER_PRIVATE_KEY

# Note the deployed address → set HTLC_CONTRACT_ADDRESS
```

After deployment, the agent wallet needs to approve the HTLC contract to spend USDC. This happens automatically on the first payment (the `DirectTransferClient` calls `approveUSDCForHTLC()` which sets unlimited approval).

### PayproofRegistry (Arc Testnet)

Deploy after the HTLC contract, then register version 1:

```bash
# Deploy registry
forge create contracts/PayproofRegistry.sol:PayproofRegistry \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key $DEPLOYER_PRIVATE_KEY

# Register HTLC as version 1
cast send $REGISTRY_ADDRESS "registerVersion(address)" $HTLC_CONTRACT_ADDRESS \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key $DEPLOYER_PRIVATE_KEY
```

### htlc-solana (Solana Devnet)

```bash
# Build (use cargo build-sbf, NOT anchor build)
cargo build-sbf --tools-version v1.52 \
  --manifest-path programs/htlc-solana/Cargo.toml

# Deploy
solana program deploy \
  target/deploy/htlc_solana.so \
  --url devnet \
  --keypair ~/.config/solana/id.json \
  --program-id target/deploy/htlc_solana-keypair.json

# Note the program ID → set HTLC_SOLANA_PROGRAM_ID
```

After deployment, initialize the ProgramConfig with the treasury address. This only needs to be done once:

```bash
# Via the Anchor client or a script that calls initialize_config(treasury_pubkey)
```

The upgraded program uses 258-byte LockAccount (extended from 186 bytes) with three new fields:
- `data_deadline: i64` — confirmation window expiry timestamp
- `data_hash: [u8; 32]` — SHA-256 of encrypted ciphertext
- `receipt_hash: [u8; 32]` — agent's confirmed receipt hash

## Running the Application

### Development

```bash
pnpm install
pnpm -r build      # Build all packages first
pnpm dev            # Starts marketplace on localhost:3000
```

Opens at `http://localhost:3000`.

### Production Build

```bash
pnpm -r build
pnpm --filter marketplace start
```

### Encrypted Flow Mode

Set `PAYPROOF_ENCRYPTED_FLOW=true` in `.env.local` to enable the full atomic encrypted data-for-payment flow. In this mode, the middleware intercepts responses, encrypts them with the HTLC preimage, and returns `EncryptedPayload` responses.

Without this flag, the system operates in passthrough mode (data returned unencrypted, HTLC used only for payment).

## Maintenance

### Redeploying Contracts

1. **EVM**: Run forge create/deploy again. Update `HTLC_CONTRACT_ADDRESS` in `.env.local`. Re-register in PayproofRegistry if needed.
2. **Solana**: Run `cargo build-sbf` then `solana program deploy`. The program ID stays the same if using the same keypair.
3. **Rebuild packages**: After changing addresses, run `pnpm -r build` to pick up new constants.

### Updating Environment

After changing any env var in `.env.local`:
1. Restart the dev server (`pnpm dev`)
2. The test suite reads env vars at startup via `tests/setup.ts`

### Package Dependency Updates

```bash
pnpm update -r          # Update all packages
pnpm -r build           # Rebuild
pnpm test:unit          # Verify unit tests pass
```

## Verification Checklist

After starting the app, verify the encrypted payment flow works:

1. **Dashboard loads** — Three tabs visible (Agent, Marketplace, Merchant)
2. **Wallet balances show** — Non-zero balances on at least one chain
3. **Marketplace shows APIs** — Weather ($0.001), Markets ($0.01), Sentiment ($0.05)
4. **Agent runs** — Set goal "Check my balances", budget "0.00" — should complete without payment
5. **Payment works** — Set goal "Buy weather data on Arc", budget "0.01" — should:
   - Lock USDC on Arc HTLC
   - Receive encrypted payload
   - Confirm receipt on-chain
   - Watch for merchant claim
   - Decrypt and display data
6. **Merchant updates** — After purchase, Merchant tab shows the HTLC claim transaction
7. **Lock tracking** — Agent can run "Check pending payments" to see lock status
8. **Refund works** — Create a lock, wait 5 minutes, then "Refund expired lock"

## Troubleshooting

### "AGENT_PRIVATE_KEY not set"

The EVM wallet key is missing. Set it in `.env.local`. Must be a hex private key without `0x` prefix.

### "MERCHANT_PRIVATE_KEY not set — required for HTLC claim"

The server can't sign claim transactions. Required for Arc/Solana HTLC payments. Base Sepolia "exact" payments use the hosted facilitator and don't need this.

### "Preimage not found or expired for this hashlock"

The server-side preimage store has a 5-minute TTL. If the client takes too long between getting payment requirements and submitting payment, the preimage expires. The client can refund after the timelock expires.

### "post_data_hash_failed"

The on-chain transaction to commit the encrypted data hash failed. Check:
- Merchant wallet has enough USDC for gas (on Arc, USDC is gas)
- HTLC contract address is correct
- Lock is still in `Locked` state (not expired)

### Solana "confirmTransaction" timeouts

Common on devnet. The facilitator handles this with a fallback to `getSignatureStatuses`. If the claim truly failed, the agent can use `check_pending_payments` and `refund_expired_lock` to recover.

### "Lock hashlock does not match expected"

The x402 middleware's enhancement cache expired between the initial 402 response and the payment retry. The cache TTL is 60 seconds. This can happen if the client takes more than 60 seconds to create the HTLC lock. Retry — the next request gets a fresh hashlock.

### Agent gets 402 despite payment

Usually means the payment verification failed. Common causes:
- Lock amount less than required (rounding issues)
- Lock recipient doesn't match merchant address
- Lock timelock already expired
- Wrong hashlock (cache mismatch, see above)

Check server logs for `[facilitator]` messages which include detailed verification results.

### "hash mismatch" on confirmReceipt

The `receiptHash` computed by the agent doesn't match the `dataHash` posted by the merchant. This indicates the encrypted payload was corrupted in transit. The lock will transition to `Treasury` after the `dataDeadline` expires.

## Architecture Notes for Production

The prototype uses in-memory stores for simplicity. Production deployments replace these:

| Component | Prototype | Production |
|-----------|-----------|------------|
| Preimage store | In-memory Map, 5-min TTL | Redis or database with TTL |
| Merchant ledger | In-memory array | Database (PostgreSQL, etc.) |
| Pending locks | In-memory Map | Database + on-chain indexing |
| Enhancement cache | In-memory Map, 60s TTL | Redis with TTL |
| Replay protection | In-memory Set | Database or distributed cache |

The on-chain HTLC state is always persistent and serves as the ultimate source of truth.
