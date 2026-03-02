# Competitive Analysis

## The Agentic Payments Landscape

AI agents are becoming autonomous economic actors — buying data, consuming APIs, paying for compute. The market for machine-to-machine payments is emerging, and several players are positioning to own the infrastructure layer.

Payproof's thesis: **the payment layer for agents must be trustless**. Agents can't call customer support. They can't dispute charges. They need cryptographic guarantees, not terms of service.

## x402 Protocol (Coinbase)

### What It Is

The [x402 protocol](https://www.x402.org/) defines a standard for machine-to-machine payments over HTTP. When a server requires payment, it returns `HTTP 402 Payment Required` with structured payment requirements. The client pays, retries with a payment proof, and gets the resource.

### How the "Exact" Scheme Works

1. Server returns 402 with payment requirements (amount, token, recipient)
2. Client signs a Permit2 allowance (ERC-20 signature, no on-chain tx)
3. Client retries request with signed payment in headers
4. Server forwards the signed payment to a **facilitator** (e.g., x402.org)
5. Facilitator broadcasts the transaction on-chain
6. Server returns data to client

### Limitations

| Issue | Detail |
|-------|--------|
| **Not atomic** | Payment is signed before data delivery. The agent pays, then hopes for data. |
| **No defect protection** | Once the signature is submitted to the facilitator, it's broadcasted regardless of data quality. |
| **Facilitator trust** | The x402.org facilitator must be trusted not to steal (by taking the payment without forwarding to the merchant), censor (by refusing to process), or front-run. |
| **No finality handling** | No built-in mechanism for transaction confirmation or failure recovery. |
| **No dispute resolution** | If the merchant doesn't deliver, or delivers garbage, the agent has no recourse. |

### Payproof's Position

Payproof uses x402 as the **transport layer** — the 402 response, payment headers, and client/server negotiation. But for the `direct` scheme, we replace the trust-based facilitator with cryptographic atomicity. The preimage that unlocks payment IS the decryption key. No facilitator needed.

We also support the exact scheme on Base Sepolia for backward compatibility with the existing x402 ecosystem.

## Coinbase

### Position

Coinbase is building the agent infrastructure stack: Base chain, CDP wallet infrastructure, AgentKit for agent-blockchain interaction, and the x402 protocol. Their network effects are significant — Base has ecosystem momentum, CDP simplifies wallet management, and x402 is becoming a de facto standard.

### Technical Edge

The exact scheme provides simplicity (no on-chain escrow, just signed approvals) but **no atomicity**. The architecture fundamentally requires trust in the facilitator.

### Payproof's Position

We don't compete with Coinbase's infrastructure — we build on top of it. Payproof supports the exact scheme for Base Sepolia compatibility AND offers the superior direct scheme for chains that support it. Merchants and agents can use both, choosing trust-for-simplicity or cryptography-for-guarantees per transaction.

## Circle

### Position

Circle provides the stablecoin infrastructure layer: USDC (the asset), Arc (the chain), Gateway (batching/settlement), and growing x402 integration. Their vision is USDC as the universal money layer, with Arc as the institutional-grade chain.

### Gap

Circle provides excellent **monetary infrastructure** but no **atomicity layer**. There's no data-for-payment protocol, no dispute resolution, and no cryptographic guarantee that payment equals delivery. USDC moves, but there's no guarantee data moves with it.

### Payproof's Position

Payproof builds ON Circle's stack. We use USDC as the payment token, Arc as the primary chain (USDC-native gas is perfect for micropayments), and integrate with Circle's ecosystem. We add the missing piece: the trustless data-for-payment protocol that makes USDC useful for autonomous agent commerce.

## Arc (Circle's Chain)

### Advantages

- **USDC-native gas**: No volatile token needed for gas fees — agents only need USDC
- **Sub-second finality**: Fast enough for real-time micropayments
- **Institutional backing**: Circle's credibility and regulatory compliance
- **EVM compatible**: Existing Solidity contracts deploy directly

### Arc vs Solana

| | Arc | Solana |
|---|---|---|
| **Gas token** | USDC (native) | SOL (volatile) |
| **Maturity** | Testnet | Live mainnet with DeFi ecosystem |
| **Transaction speed** | Sub-second | ~400ms |
| **Ecosystem** | Emerging | Mature — DeFi, NFTs, DePIN |
| **Agent UX** | Simpler — one token for everything | Requires SOL management alongside USDC |

### Payproof's Position

Multi-chain from day one. Arc for institutional/stablecoin use cases where USDC-native gas simplifies agent operations. Solana for access to the broader DeFi ecosystem and existing liquidity. The same HTLC protocol works on both — same state machine, same game theory, same cryptographic guarantees.

## Payproof's Unique Edge

1. **Only solution with atomic data-for-payment**: The HTLC preimage IS the AES-256-GCM encryption key. No other protocol links payment revelation to data decryption.

2. **Game-theoretic guarantees**: No rational actor can cheat profitably. Disputed funds go to a neutral treasury — neither party benefits from defection.

3. **Non-custodial, no trusted facilitator**: For the direct scheme, funds are locked in on-chain escrow. No third party holds or routes payments.

4. **Multi-chain from day one**: Same protocol on EVM (Arc) and Solana. Same developer experience, same security model.

5. **x402 compatible**: Not trying to replace the standard — extending it. Merchants and agents that already use x402 can adopt Payproof's direct scheme incrementally.

6. **SDK-first**: Agent sees `fetch() → plaintext`. Merchant returns data from route handler. The 14-step protocol is invisible to both parties.
