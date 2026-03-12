# Roadmap

## Current State (v0.1)

Atomic data-for-payment protocol implemented and running on live testnets:

- **Arc Testnet**: Full 7-state HTLC with AES-256-GCM encryption, USDC payments
- **Base Sepolia**: x402 exact scheme compatibility via hosted facilitator
- **SDK packages**: `@payproof/client`, `@payproof/server`, `@payproof/contracts` extracted from prototype
- **Reference app**: Full marketplace with Claude agent, 3 paywalled APIs, multi-chain wallet management

## Near-Term

### Enhance Exact Scheme with Atomic Guarantees

Apply Payproof's encryption + confirmation protocol on top of x402's exact scheme. Agents using Base/exact currently trust the facilitator — with this enhancement, they get the same atomic guarantees as the direct scheme. The facilitator handles the Permit2 broadcast, but data delivery still requires preimage revelation.

### Mainnet Deployments

- **Arc mainnet** (when available): Deploy audited HTLC + Registry contracts

### Onboarding Tools

- Key generation CLI: `npx @payproof/cli init` generates agent/merchant keypairs
- Balance tracking dashboard: Web UI for monitoring agent spend across chains
- Wallet setup wizard: Guided flow for testnet faucets and contract approvals

### Agent Tools Expansion

Pre-built tools for popular AI frameworks:
- **MCP tools**: For Claude and other MCP-compatible agents
- **OpenAI function-calling tools**: Compatible tool definitions
- **LangChain integration**: Custom tool wrappers for LangChain agents

## Mid-Term

### Agentic Facilitator

Smart contract-driven facilitator that replaces x402.org for the exact scheme:
- Permissionless — anyone can run a facilitator node
- On-chain verification — facilitator behavior is auditable
- No single point of failure or censorship

### Opt-in Data Catalog

Merchants register APIs with pricing, descriptions, and schemas:
- Agents discover and compare data sources programmatically
- Standardized API metadata format
- Price comparison across merchants for equivalent data

### Reputation System

On-chain reputation derived from smart contract interactions:
- Delivery success rate (claims vs refunds vs treasury)
- Average confirmation time
- Dispute history
- All verifiable directly from blockchain events

### Batch Settlements

Aggregate multiple micro-payments into single on-chain settlements:
- Payment channels for recurring agent-merchant relationships
- Gas cost amortized across many transactions
- Useful for high-frequency, low-value data feeds

### Multi-Token Support

Agents pay with any token, automatic swap to merchant's preferred token:
- DEX integration (Uniswap, Jupiter) for on-chain swaps
- Quote aggregation for best execution
- Merchant always receives USDC regardless of agent's payment token

## Long-Term

### Cross-Chain Atomic Swaps

Agent on one EVM chain pays merchant on another — trustless cross-chain data-for-payment:
- Shared hashlock across chains
- Relay network for cross-chain event propagation
- Same game-theoretic guarantees as single-chain protocol

### Subscription / Streaming Payments

Recurring data feeds with HTLC-based payment channels:
- Open a channel once, stream micro-payments per data update
- Channel settlement on-chain only when closing or disputing
- Suitable for real-time market data, sensor feeds, API subscriptions

### Privacy Layer

Zero-knowledge proofs for payment amounts and participant identities:
- ZK proofs that payment satisfies minimum amount without revealing exact value
- Anonymous agent identities while maintaining reputation
- Shielded transactions for competitive intelligence use cases

### Protocol Standardization

Propose Payproof protocol as an extension to the x402 standard:
- Formal specification (RFC-style)
- Reference implementations in multiple languages
- Interoperability testing suite
- Community governance for protocol evolution
