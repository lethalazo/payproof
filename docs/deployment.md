# Deployment Guide

> This covers running the Payproof prototype locally on testnets. For production deployment of `@payproof/server` and `@payproof/client`, see the [SDK Guide](sdk-guide.md).

## Prerequisites

- **Node.js** 18+ and **pnpm** (for monorepo)
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
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Marketplace | Claude API key |
| `AGENT_PRIVATE_KEY` | `0x...` hex | Client SDK | Agent's EVM private key (Base Sepolia + Arc) |
| `MERCHANT_ADDRESS` | `0x...` | Server SDK, Client SDK | EVM address that receives payments |
| `MERCHANT_PRIVATE_KEY` | Hex (no 0x prefix) | Server SDK | Merchant's EVM key (signs HTLC claims on Arc) |
| `HTLC_CONTRACT_ADDRESS` | `0x...` | Server SDK, Client SDK | Deployed HTLC.sol address on Arc Testnet |
| `PAYPROOF_REGISTRY_ADDRESS` | `0x...` | Client SDK | PayproofRegistry contract on Arc Testnet |
| `TREASURY_ADDRESS` | `0x...` | HTLC constructor | Treasury address for dispute resolution |

### Optional Variables

| Variable | Default | Read By | Description |
|----------|---------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Marketplace | Self-referential URL for internal API calls |
| ~~`PAYPROOF_ENCRYPTED_FLOW`~~ | — | — | *Removed* — encrypted mode is now auto-detected via `scheme: "direct"` in the payment header |

### Deployed Contract Addresses

| Contract | Network | Address |
|----------|---------|---------|
| HTLC (7-state) | Arc Testnet | `0x6C14aDD48bF2D4D01Df5D98Ab5A7Ac2DcD181bd7` |
| PayproofRegistry | Arc Testnet | `0x811A8C492697d3EfbbA754748F34bAF8B59FfCf3` |
| USDC | Arc Testnet | `0x3600000000000000000000000000000000000000` |
| USDC | Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Key Management

The system uses **two separate key pairs** (four keys total):

### Agent Keys

These are the AI agent's wallet keys. The agent uses them to:
- Check balances
- Lock USDC in HTLC escrow (paying for data)
- Confirm receipt of encrypted data on-chain
- Refund expired locks

```
AGENT_PRIVATE_KEY       → Derives EVM address used on Base Sepolia + Arc Testnet
```

The same EVM private key is used for both Base Sepolia and Arc Testnet because they share the same address space.

### Merchant Keys

These are the data provider's wallet keys. The server uses them to:
- Post dataHash on-chain (committing encrypted data)
- Sign HTLC claim transactions (receiving payment by revealing preimage)

```
MERCHANT_PRIVATE_KEY          → Signs postDataHash() and claim() on Arc Testnet
MERCHANT_ADDRESS              → Receives funds on Base Sepolia + Arc
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

## Build Process

The monorepo build order matters — packages depend on each other:

```bash
# 1. Install all dependencies
pnpm install

# 2. Build in dependency order (contracts → server → client → marketplace)
pnpm -r build
```

Each package uses `tsup` for TypeScript bundling. The build command in each `package.json` runs `tsup src/index.ts --format esm --dts`.

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

The full atomic encrypted data-for-payment flow is **automatically enabled** when a payment uses the `scheme: "direct"` (HTLC) payment header. No environment variable is needed — the middleware detects the scheme from the payment header and routes accordingly.

- **Direct scheme** (`scheme: "direct"`): Full encrypted flow — verify lock, encrypt data, post dataHash, return `EncryptedPayload`, claim after confirmation
- **Exact scheme** (`scheme: "exact"`): Passthrough to x402 base handler — data returned unencrypted

## Maintenance

### Redeploying Contracts

1. **EVM**: Run forge create/deploy again. Update `HTLC_CONTRACT_ADDRESS` in `.env.local`. Re-register in PayproofRegistry if needed.
2. **Rebuild packages**: After changing addresses, run `pnpm -r build` to pick up new constants.

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

The server can't sign claim transactions. Required for Arc HTLC payments. Base Sepolia "exact" payments use the hosted facilitator and don't need this.

### "Preimage not found or expired for this hashlock"

The server-side preimage store has a 30-minute TTL. If the client takes too long between getting payment requirements and submitting payment, the preimage expires. The client can refund after the timelock expires.

### "post_data_hash_failed"

The on-chain transaction to commit the encrypted data hash failed. Check:
- Merchant wallet has enough USDC for gas (on Arc, USDC is gas)
- HTLC contract address is correct
- Lock is still in `Locked` state (not expired)

### "Lock hashlock does not match expected"

The preimage for the hashlock provided in the 402 response has expired or been consumed. The `PreimageStore` has a 30-minute TTL, and `consumePreimage()` deletes after first use. This can happen if the client reuses a stale 402 response. Retry — the next request gets a fresh hashlock.

### Agent gets 402 despite payment

Usually means the payment verification failed. Common causes:
- Lock amount less than required (rounding issues)
- Lock recipient doesn't match merchant address
- Lock timelock already expired
- Wrong hashlock (stale 402 response, see above)

Check server logs for `[facilitator]` messages which include detailed verification results.

### "hash mismatch" on confirmReceipt

The `receiptHash` computed by the agent doesn't match the `dataHash` posted by the merchant. This indicates the encrypted payload was corrupted in transit. The lock will transition to `Treasury` after the `dataDeadline` expires.

## Architecture Notes for Production

The prototype uses in-memory stores for simplicity. Production deployments replace these:

| Component | Prototype | Production |
|-----------|-----------|------------|
| Preimage store | In-memory Map, 30-min TTL | Redis or database with TTL |
| Merchant ledger | In-memory array | Database (PostgreSQL, etc.) |
| Pending locks | In-memory Map | Database + on-chain indexing |
| Claimed locks dedup | In-memory Map, 30-min TTL sweep | Database or distributed cache |

The on-chain HTLC state is always persistent and serves as the ultimate source of truth.
