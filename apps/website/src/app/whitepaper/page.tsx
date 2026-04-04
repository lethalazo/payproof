import type { Metadata } from "next";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Payproof Protocol Whitepaper — Atomic Data-for-Payment via HTLC",
  description:
    "Technical specification for the Payproof protocol. Atomic data-for-payment using HTLC preimage as AES-256-GCM encryption key.",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id}>
      <h2 className="font-serif text-2xl mt-16 mb-6">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-base leading-relaxed text-foreground/80">{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-sans font-medium text-foreground text-lg mt-8 mb-3">{children}</h3>;
}

function C({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-sm bg-muted/50 px-1.5 py-0.5 rounded">{children}</code>;
}

const tocItems = [
  { id: "abstract", label: "Abstract" },
  { id: "introduction", label: "1. Introduction" },
  { id: "protocol-design", label: "2. Protocol Design" },
  { id: "cryptographic-construction", label: "3. Cryptographic Construction" },
  { id: "game-theory", label: "4. Game Theory" },
  { id: "protocol-flow", label: "5. Protocol Flow" },
  { id: "failure-modes", label: "6. Failure Modes & Recovery" },
  { id: "multi-chain", label: "7. Multi-Chain Architecture" },
  { id: "sdk", label: "8. SDK & Developer Experience" },
  { id: "competitive-analysis", label: "9. Competitive Analysis" },
  { id: "roadmap", label: "10. Roadmap" },
  { id: "references", label: "References" },
];

export default function WhitepaperPage() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-20">
        <div className="lg:flex lg:gap-16">
          {/* TOC - sticky sidebar on desktop */}
          <nav className="hidden lg:block lg:w-56 shrink-0">
            <div className="sticky top-24 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Contents
              </p>
              {tocItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>

          {/* Article */}
          <article className="max-w-[720px]">
            {/* Title */}
            <h1 className="font-serif text-3xl md:text-4xl">
              Payproof Protocol Whitepaper
            </h1>
            <p className="text-sm text-muted-foreground mt-3">
              Protocol v1 | April 2026
            </p>

            {/* ── Abstract ── */}
            <Section id="abstract" title="Abstract">
              <P>
                Payproof is an atomic data-for-payment protocol designed for
                autonomous AI agent commerce. It leverages Hash Time-Locked
                Contracts (HTLCs) with a novel cryptographic construction: the
                32-byte preimage that unlocks escrowed payment simultaneously
                serves as the AES-256-GCM symmetric encryption key for the
                purchased data. This creates a trustless exchange where the
                merchant can only receive payment by revealing the decryption key
                on-chain, and the agent can only obtain the decryption key after
                the merchant claims the escrow. The protocol defines a 7-state
                machine with two independent timelocks, a neutral treasury
                mechanism for dispute resolution, and a game-theoretic framework
                in which no rational actor can profit by defecting. Payproof
                extends the x402 HTTP payment standard with its{" "}
                <C>
                  direct
                </C>{" "}
                scheme, replacing trusted facilitators with cryptographic
                atomicity. The protocol is chain-agnostic by design, with a
                reference implementation deployed on EVM (Circle Arc) and
                architecture ready for Solana. All hashlock operations use
                SHA-256 for cross-chain compatibility.
              </P>
            </Section>

            {/* ── 1. Introduction ── */}
            <Section id="introduction" title="1. Introduction">
              <P>
                Intelligence is approaching zero marginal cost. As large language
                models become commoditized, AI agents are emerging as autonomous
                economic actors -- purchasing data, consuming APIs, paying for
                compute, and transacting with other agents and services without
                human intervention. This shift demands a payment infrastructure
                fundamentally different from anything built for human commerce.
              </P>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                The structural problem is trust. When a human buys a product
                online and the merchant fails to deliver, the human can call
                customer support, file a chargeback, or leave a negative review.
                An AI agent has none of these recourses. Agents operate
                programmatically, at machine speed, across thousands of
                transactions per hour. They cannot navigate dispute resolution
                flows designed for humans. They need{" "}
                <span className="font-medium text-foreground">
                  cryptographic guarantees, not terms of service
                </span>
                .
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                The prevailing approach to machine-to-machine payments is the
                x402 protocol, introduced by Coinbase. x402 defines a standard
                HTTP flow: a server returns{" "}
                <C>
                  HTTP 402 Payment Required
                </C>{" "}
                with structured payment requirements, the client signs a payment
                authorization, retries with the payment proof, and receives the
                resource. The standard&apos;s{" "}
                <C>
                  exact
                </C>{" "}
                scheme uses ERC-20 Permit2 signatures -- the agent signs an
                allowance off-chain, a facilitator broadcasts the transaction,
                and the server delivers data. This is elegant in its simplicity
                but fundamentally{" "}
                <span className="font-medium text-foreground">not atomic</span>.
                The agent pays before receiving data. The facilitator must be
                trusted not to steal, censor, or front-run. If the merchant
                delivers garbage or nothing at all, the agent has no recourse.
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                Payproof addresses this gap. We use x402 as the transport layer
                -- the 402 response, the payment headers, the client/server
                negotiation -- but for the{" "}
                <C>
                  direct
                </C>{" "}
                scheme, we replace the trust-based facilitator with
                cryptographic atomicity. The HTLC preimage that unlocks payment{" "}
                <span className="font-medium text-foreground">is</span> the
                AES-256-GCM encryption key for the data. This construction makes
                payment and data delivery inseparable: the merchant reveals the
                key to get paid, and the agent obtains the key to decrypt. No
                facilitator. No trust. No recourse needed, because neither party
                can cheat.
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                This whitepaper specifies the Payproof protocol in full: the
                state machine, the cryptographic construction, the game-theoretic
                guarantees, the failure modes, and the SDK architecture that
                reduces the 14-step protocol to a single{" "}
                <C>
                  fetch()
                </C>{" "}
                call for agent developers.
              </p>
            </Section>

            {/* ── 2. Protocol Design ── */}
            <Section id="protocol-design" title="2. Protocol Design">
              <H3>
                2.1 The 7-State Machine
              </H3>
              <P>
                The Payproof HTLC is a deterministic finite automaton with seven
                states and six transitions. Every lock begins in the{" "}
                <C>
                  Empty
                </C>{" "}
                state and terminates in exactly one of three terminal states:{" "}
                <C>
                  Claimed
                </C>{" "}
                (successful exchange),{" "}
                <C>
                  Refunded
                </C>{" "}
                (merchant non-responsive), or{" "}
                <C>
                  Treasury
                </C>{" "}
                (dispute). State can only move forward -- there are no rollback
                transitions except the refund path from{" "}
                <C>
                  Locked
                </C>
                .
              </P>


              <H3>
                2.2 State Definitions
              </H3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 pr-4 font-medium">State</th>
                      <th className="text-left py-2 pr-4 font-medium">Value</th>
                      <th className="text-left py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="font-sans text-foreground/80">
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>Empty</C>
                      </td>
                      <td className="py-2 pr-4">0</td>
                      <td className="py-2">No lock exists for this ID (default state)</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>Locked</C>
                      </td>
                      <td className="py-2 pr-4">1</td>
                      <td className="py-2">Agent has locked USDC in escrow, awaiting merchant data</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>DataPosted</C>
                      </td>
                      <td className="py-2 pr-4">2</td>
                      <td className="py-2">Merchant posted encrypted data hash, confirmation deadline active</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>Confirmed</C>
                      </td>
                      <td className="py-2 pr-4">3</td>
                      <td className="py-2">Agent confirmed receipt of encrypted data (hashes match)</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>Claimed</C>
                      </td>
                      <td className="py-2 pr-4">4</td>
                      <td className="py-2">Merchant claimed USDC by revealing preimage on-chain</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>Refunded</C>
                      </td>
                      <td className="py-2 pr-4">5</td>
                      <td className="py-2">Agent reclaimed funds after timelock expiry</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>Treasury</C>
                      </td>
                      <td className="py-2 pr-4">6</td>
                      <td className="py-2">Funds sent to neutral treasury (unresolvable dispute)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <H3>
                2.3 Transition Table
              </H3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 pr-4 font-medium">#</th>
                      <th className="text-left py-2 pr-4 font-medium">From</th>
                      <th className="text-left py-2 pr-4 font-medium">To</th>
                      <th className="text-left py-2 pr-4 font-medium">Caller</th>
                      <th className="text-left py-2 pr-4 font-medium">Preconditions</th>
                      <th className="text-left py-2 font-medium">Effects</th>
                    </tr>
                  </thead>
                  <tbody className="font-sans text-foreground/80">
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">1</td>
                      <td className="py-2 pr-4">Empty</td>
                      <td className="py-2 pr-4">Locked</td>
                      <td className="py-2 pr-4">Agent</td>
                      <td className="py-2 pr-4">
                        <C>amount &gt; 0</C>,{" "}
                        <C>timelock &gt; now</C>,
                        valid recipient
                      </td>
                      <td className="py-2">Token transferred to escrow; lock fields stored</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">2</td>
                      <td className="py-2 pr-4">Locked</td>
                      <td className="py-2 pr-4">DataPosted</td>
                      <td className="py-2 pr-4">Merchant</td>
                      <td className="py-2 pr-4">
                        <C>state == Locked</C>,{" "}
                        <C>now &lt; timelock</C>,
                        caller is recipient
                      </td>
                      <td className="py-2">
                        <C>dataHash</C> stored,{" "}
                        <C>dataDeadline = now + 120s</C>
                      </td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">3</td>
                      <td className="py-2 pr-4">DataPosted</td>
                      <td className="py-2 pr-4">Confirmed</td>
                      <td className="py-2 pr-4">Agent</td>
                      <td className="py-2 pr-4">
                        <C>state == DataPosted</C>,{" "}
                        <C>now &lt; dataDeadline</C>,{" "}
                        <C>receiptHash == dataHash</C>
                      </td>
                      <td className="py-2">
                        <C>receiptHash</C> stored
                      </td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">4</td>
                      <td className="py-2 pr-4">Confirmed</td>
                      <td className="py-2 pr-4">Claimed</td>
                      <td className="py-2 pr-4">Anyone</td>
                      <td className="py-2 pr-4">
                        <C>state == Confirmed</C>,{" "}
                        <C>SHA-256(preimage) == hashlock</C>
                      </td>
                      <td className="py-2">Token transferred to recipient</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">5</td>
                      <td className="py-2 pr-4">Locked</td>
                      <td className="py-2 pr-4">Refunded</td>
                      <td className="py-2 pr-4">Anyone</td>
                      <td className="py-2 pr-4">
                        <C>state == Locked</C>,{" "}
                        <C>now &gt;= timelock</C>
                      </td>
                      <td className="py-2">Token returned to sender</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">6</td>
                      <td className="py-2 pr-4">DataPosted</td>
                      <td className="py-2 pr-4">Treasury</td>
                      <td className="py-2 pr-4">Anyone</td>
                      <td className="py-2 pr-4">
                        <C>state == DataPosted</C>,{" "}
                        <C>now &gt;= dataDeadline</C>
                      </td>
                      <td className="py-2">Token sent to treasury address</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <H3>
                2.4 The Two-Timelock System
              </H3>
              <P>
                The protocol uses two independent timelocks to bound commitment
                for both parties. The primary{" "}
                <C>
                  timelock
                </C>{" "}
                is set when the agent calls{" "}
                <C>
                  lock()
                </C>{" "}
                and defaults to 300 seconds (5 minutes). This is the overall
                deadline: if the merchant never posts their data hash, the agent
                can reclaim funds after this period. The{" "}
                <C>
                  timelock
                </C>{" "}
                protects the agent from unresponsive merchants.
              </P>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                The secondary{" "}
                <C>
                  dataDeadline
                </C>{" "}
                is set dynamically when the merchant calls{" "}
                <C>
                  postDataHash()
                </C>
                , computed as{" "}
                <C>
                  block.timestamp + CONFIRMATION_WINDOW
                </C>{" "}
                where{" "}
                <C>
                  CONFIRMATION_WINDOW = 120s
                </C>
                . This gives the agent 2 minutes to verify the encrypted data
                and submit{" "}
                <C>
                  confirmReceipt()
                </C>
                . If the agent fails to confirm -- whether due to a crash,
                network failure, or deliberate non-confirmation -- funds are sent
                to the neutral treasury rather than back to the agent. The{" "}
                <C>
                  dataDeadline
                </C>{" "}
                protects the merchant from agents who receive data but refuse to
                confirm.
              </p>

              <div className="overflow-x-auto mt-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 pr-4 font-medium">Timelock</th>
                      <th className="text-left py-2 pr-4 font-medium">Duration</th>
                      <th className="text-left py-2 pr-4 font-medium">Set When</th>
                      <th className="text-left py-2 font-medium">Protects</th>
                    </tr>
                  </thead>
                  <tbody className="font-sans text-foreground/80">
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>timelock</C>
                      </td>
                      <td className="py-2 pr-4">300s (5 min)</td>
                      <td className="py-2 pr-4">
                        <C>lock()</C> called
                      </td>
                      <td className="py-2">Agent -- can refund if merchant never responds</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>dataDeadline</C>
                      </td>
                      <td className="py-2 pr-4">+120s (2 min)</td>
                      <td className="py-2 pr-4">
                        <C>postDataHash()</C> called
                      </td>
                      <td className="py-2">Merchant -- if agent ghosts, treasury gets funds (not agent)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <H3>
                2.5 Lock Structure
              </H3>
              <P>
                Every conforming implementation must store the following fields
                per lock. All fields are publicly readable for cross-party
                verification.
              </P>
              <div className="overflow-x-auto mt-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 pr-4 font-medium">Field</th>
                      <th className="text-left py-2 pr-4 font-medium">Type</th>
                      <th className="text-left py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="font-sans text-foreground/80">
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>sender</C>
                      </td>
                      <td className="py-2 pr-4">address</td>
                      <td className="py-2">Agent who locked funds</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>recipient</C>
                      </td>
                      <td className="py-2 pr-4">address</td>
                      <td className="py-2">Merchant who receives payment</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>token</C>
                      </td>
                      <td className="py-2 pr-4">address</td>
                      <td className="py-2">Payment token (USDC)</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>amount</C>
                      </td>
                      <td className="py-2 pr-4">uint256</td>
                      <td className="py-2">Atomic token units locked</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>hashlock</C>
                      </td>
                      <td className="py-2 pr-4">bytes32</td>
                      <td className="py-2">SHA-256(preimage) commitment</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>timelock</C>
                      </td>
                      <td className="py-2 pr-4">uint256</td>
                      <td className="py-2">Unix timestamp after which refund is allowed</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>dataDeadline</C>
                      </td>
                      <td className="py-2 pr-4">uint256</td>
                      <td className="py-2">Unix timestamp after which treasury sweep is allowed</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>dataHash</C>
                      </td>
                      <td className="py-2 pr-4">bytes32</td>
                      <td className="py-2">SHA-256(ciphertext) committed by merchant</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>receiptHash</C>
                      </td>
                      <td className="py-2 pr-4">bytes32</td>
                      <td className="py-2">SHA-256(ciphertext) confirmed by agent</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">
                        <C>state</C>
                      </td>
                      <td className="py-2 pr-4">enum</td>
                      <td className="py-2">Current state (0-6)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* ── 3. Cryptographic Construction ── */}
            <Section
              id="cryptographic-construction"
              title="3. Cryptographic Construction"
            >
              <H3>
                3.1 The Preimage-as-Key Insight
              </H3>
              <P>
                The central cryptographic innovation of Payproof is the dual use
                of the HTLC preimage. In a standard HTLC, the preimage is a
                random secret whose hash serves as a commitment -- the party who
                knows the preimage can unlock escrowed funds by revealing it
                on-chain. Payproof extends this by using the same 32-byte
                preimage as the symmetric encryption key for the data being
                purchased.
              </P>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                This creates an elegant coupling: the merchant generates a
                cryptographically random 32-byte preimage using{" "}
                <C>
                  crypto.getRandomValues(new Uint8Array(32))
                </C>
                , computes{" "}
                <C>
                  hashlock = SHA-256(preimage)
                </C>
                , and shares the hashlock with the agent in the 402 response. The
                agent locks funds against this hashlock. The merchant then
                encrypts the data using the preimage as the AES-256-GCM key and
                commits the ciphertext hash on-chain. To get paid, the merchant
                must call{" "}
                <C>
                  claim(preimage)
                </C>{" "}
                -- revealing the preimage in a public on-chain event. The agent
                reads this event and uses the preimage to decrypt the data.
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                The atomicity guarantee follows from the structure: the merchant{" "}
                <span className="font-medium text-foreground">cannot</span>{" "}
                receive payment without revealing the decryption key, and the
                agent{" "}
                <span className="font-medium text-foreground">cannot</span>{" "}
                obtain the decryption key without the merchant claiming payment.
                There is no sequence of actions by either party that breaks this
                invariant.
              </p>

              <H3>
                3.2 SHA-256 for Cross-Chain Hashlocks
              </H3>
              <P>
                All hash operations in Payproof use SHA-256, not keccak256. This
                is a deliberate design choice for cross-chain compatibility.
                While keccak256 is the native hash function on EVM chains,
                SHA-256 is universally available -- including on Solana, where
                keccak256 is not natively supported. By using SHA-256, the same
                hashlock can be verified on any chain, enabling future cross-chain
                atomic swaps where an agent on one chain pays a merchant on
                another.
              </P>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                Three hash operations are defined in the protocol:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1 font-sans text-base leading-relaxed text-foreground/80">
                <li>
                  <span className="font-medium text-foreground">Hashlock:</span>{" "}
                  <C>
                    SHA-256(preimage)
                  </C>{" "}
                  -- the HTLC commitment, verified on-chain during{" "}
                  <C>
                    claim()
                  </C>
                </li>
                <li>
                  <span className="font-medium text-foreground">dataHash:</span>{" "}
                  <C>
                    SHA-256(ciphertext_bytes)
                  </C>{" "}
                  -- the merchant&apos;s commitment to the encrypted data
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    receiptHash:
                  </span>{" "}
                  agent re-computes{" "}
                  <C>
                    SHA-256(ciphertext_bytes)
                  </C>{" "}
                  to confirm receipt -- must match{" "}
                  <C>
                    dataHash
                  </C>{" "}
                  or the transaction reverts
                </li>
              </ul>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                On EVM, the{" "}
                <C>
                  sha256()
                </C>{" "}
                precompile (address 0x02) is used rather than the native{" "}
                <C>
                  keccak256
                </C>{" "}
                opcode. On Solana, SHA-256 is available as a native syscall.
              </p>

              <H3>
                3.3 AES-256-GCM Encryption Parameters
              </H3>
              <P>
                The protocol uses AES-256-GCM (Galois/Counter Mode) for
                authenticated encryption of the data payload. GCM provides both
                confidentiality and integrity verification in a single pass,
                which is critical: the agent must be able to verify that
                decryption succeeded (the auth tag validates) before considering
                the data authentic.
              </P>
              <div className="overflow-x-auto mt-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 pr-4 font-medium">Parameter</th>
                      <th className="text-left py-2 pr-4 font-medium">Size</th>
                      <th className="text-left py-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="font-sans text-foreground/80">
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Key</td>
                      <td className="py-2 pr-4">32 bytes (256 bits)</td>
                      <td className="py-2">HTLC preimage</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Nonce / IV</td>
                      <td className="py-2 pr-4">12 bytes (96 bits)</td>
                      <td className="py-2">Cryptographically random per encryption</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Auth tag</td>
                      <td className="py-2 pr-4">16 bytes (128 bits)</td>
                      <td className="py-2">Generated by GCM, verified on decryption</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Ciphertext</td>
                      <td className="py-2 pr-4">Variable</td>
                      <td className="py-2">Same length as plaintext input</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <H3>
                3.4 EncryptedPayload Format
              </H3>
              <P>
                The merchant returns the encrypted data to the agent as a
                structured payload over HTTP. The agent persists this payload
                locally until the preimage is revealed on-chain.
              </P>
              <div className="bg-[#1E1E2E] text-[#CDD6F4] rounded-xl p-5 font-mono text-sm overflow-x-auto mt-4">
                <pre>
{`interface EncryptedPayload {
  encryptedBlob: string;  // base64-encoded ciphertext
  nonce: string;          // hex (12 bytes = 24 hex chars)
  authTag: string;        // hex (16 bytes = 32 hex chars)
  dataHash: string;       // 0x-prefixed SHA-256 of ciphertext bytes
}`}
                </pre>
              </div>

              <H3>
                3.5 Data Commitment Scheme
              </H3>
              <P>
                The data commitment scheme ensures the merchant cannot swap
                encrypted data after committing. The merchant computes{" "}
                <C>
                  dataHash = SHA-256(ciphertext_bytes)
                </C>{" "}
                and posts this hash on-chain via{" "}
                <C>
                  postDataHash()
                </C>
                . The agent independently computes{" "}
                <C>
                  receiptHash = SHA-256(ciphertext_bytes)
                </C>{" "}
                from the received encrypted payload. The{" "}
                <C>
                  confirmReceipt()
                </C>{" "}
                function enforces{" "}
                <C>
                  receiptHash == dataHash
                </C>{" "}
                on-chain -- if the merchant posted a hash for different data than
                what was delivered, the confirmation transaction reverts. This
                binds the on-chain commitment to the actual bytes delivered to the
                agent.
              </P>
            </Section>

            {/* ── 4. Game Theory ── */}
            <Section id="game-theory" title="4. Game Theory">
              <H3>
                4.1 Outcome Matrix
              </H3>
              <P>
                The protocol defines five canonical scenarios covering all
                meaningful combinations of merchant and agent behavior. In every
                scenario, no rational actor can profit by defecting from the
                cooperative strategy.
              </P>

              <div className="overflow-x-auto mt-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 pr-4 font-medium">Scenario</th>
                      <th className="text-left py-2 pr-4 font-medium">Merchant Action</th>
                      <th className="text-left py-2 pr-4 font-medium">Agent Action</th>
                      <th className="text-left py-2 font-medium">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="font-sans text-foreground/80">
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4 font-medium text-foreground">Happy path</td>
                      <td className="py-2 pr-4">Posts dataHash, claims after confirmation</td>
                      <td className="py-2 pr-4">Confirms receipt</td>
                      <td className="py-2">Merchant gets USDC, agent gets data</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4 font-medium text-foreground">Merchant ghosts</td>
                      <td className="py-2 pr-4">Never posts dataHash</td>
                      <td className="py-2 pr-4">Waits for timelock</td>
                      <td className="py-2">Agent refunds after 300s</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4 font-medium text-foreground">Agent silent</td>
                      <td className="py-2 pr-4">Posts dataHash</td>
                      <td className="py-2 pr-4">Never confirms</td>
                      <td className="py-2">Treasury gets USDC after dataDeadline</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4 font-medium text-foreground">Fake hash</td>
                      <td className="py-2 pr-4">Posts wrong dataHash</td>
                      <td className="py-2 pr-4">SHA-256 mismatch, confirmReceipt reverts</td>
                      <td className="py-2">Agent does not confirm, treasury gets USDC</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4 font-medium text-foreground">Garbage data</td>
                      <td className="py-2 pr-4">Posts correct hash of garbage ciphertext</td>
                      <td className="py-2 pr-4">Agent verifies decrypted quality</td>
                      <td className="py-2">Agent may choose not to confirm, treasury gets USDC</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <H3>
                4.2 Cooperation Incentives
              </H3>
              <P>
                The protocol creates strong incentives for cooperation through
                three mechanisms:
              </P>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Merchant incentive to deliver real data:
                </span>{" "}
                The merchant only receives payment if the agent confirms receipt.
                Delivering garbage or nothing results in non-confirmation, sending
                funds to treasury. The merchant loses both the potential revenue
                and the compute cost of serving the request. Rational merchants
                always deliver genuine data.
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Agent incentive to confirm valid data:
                </span>{" "}
                If the agent receives valid data but refuses to confirm,
                the funds go to treasury -- not back to the agent. Strategic
                non-confirmation yields no benefit to the agent: they lose the
                payment amount and still cannot decrypt without the preimage.
                Rational agents always confirm valid data.
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Neither party profits from defection:
                </span>{" "}
                In every non-cooperative outcome, the defecting party is worse off
                than in the cooperative outcome. The merchant who ghosts earns
                nothing. The agent who refuses to confirm loses the payment. The
                treasury mechanism ensures that in any dispute, neither party
                captures the funds -- eliminating the economic incentive for
                adversarial behavior entirely.
              </p>

              <H3>
                4.3 Treasury as Neutral Resolution
              </H3>
              <P>
                The treasury address is set at contract deployment and is
                immutable -- it cannot be changed after deployment and has no
                admin functions. When a dispute is unresolvable (merchant posted
                data but agent did not confirm), the{" "}
                <C>
                  sendToTreasury()
                </C>{" "}
                function transfers the escrowed funds to the treasury. This
                function is callable by anyone after the{" "}
                <C>
                  dataDeadline
                </C>{" "}
                expires -- it acts as a permissionless crank. The treasury serves
                as a Schelling point: both parties know that defection leads to
                neither party getting the funds, making cooperation the dominant
                strategy in repeated games.
              </P>
            </Section>

            {/* ── 5. Protocol Flow ── */}
            <Section id="protocol-flow" title="5. Protocol Flow">
              <P>
                The complete protocol flow comprises 14 steps across three
                participants: the agent, the merchant, and the blockchain. In
                practice, the SDK abstracts all 14 steps -- the agent developer
                calls{" "}
                <C>
                  fetch()
                </C>{" "}
                and receives plaintext data. The merchant developer returns data
                from a route handler and the middleware handles encryption,
                on-chain transactions, and claim. The typical happy-path
                execution completes in under 30 seconds.
              </P>


              <H3>
                5.1 Step-by-Step Walkthrough
              </H3>

              <P>
                <span className="font-medium text-foreground">
                  Steps 1-2: Payment negotiation.
                </span>{" "}
                The agent sends a standard HTTP GET request to the merchant&apos;s
                API endpoint. The merchant&apos;s middleware intercepts the request,
                detects that the route requires payment, and returns{" "}
                <C>
                  HTTP 402 Payment Required
                </C>{" "}
                with structured{" "}
                <C>
                  PaymentRequirements
                </C>{" "}
                following the x402 standard. These include the{" "}
                <C>
                  hashlock
                </C>{" "}
                (SHA-256 of the server-generated preimage), the HTLC contract
                address, the payment amount in atomic USDC units, the network
                identifier, and the protocol version.
              </P>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Steps 3-4: Fund locking.
                </span>{" "}
                The agent generates a random 32-byte{" "}
                <C>
                  lockId
                </C>
                , approves the HTLC contract for the required USDC amount (if not
                already approved), and calls{" "}
                <C>
                  lock()
                </C>{" "}
                on the HTLC contract with the hashlock from the 402 response and
                a timelock of{" "}
                <C>
                  now + 300s
                </C>
                . The USDC is transferred from the agent&apos;s wallet to the contract
                escrow.
              </p>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Steps 5-6: Lock verification.
                </span>{" "}
                The agent retries the original request with an{" "}
                <C>
                  X-PAYMENT
                </C>{" "}
                header containing the{" "}
                <C>
                  lockId
                </C>
                , network, and hashlock. The merchant&apos;s middleware reads the lock
                from the blockchain and verifies: the recipient matches the
                merchant&apos;s address, the amount meets the price, the hashlock
                matches the preimage the merchant holds, and the timelock has
                sufficient remaining time (at least 120 seconds margin).
              </p>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Steps 7-10: Encryption and commitment.
                </span>{" "}
                The merchant&apos;s middleware calls the route handler to get the
                plaintext data, encrypts it using AES-256-GCM with the preimage
                as the key and a fresh random 12-byte nonce, computes{" "}
                <C>
                  dataHash = SHA-256(ciphertext)
                </C>
                , and posts this hash on-chain via{" "}
                <C>
                  postDataHash()
                </C>
                . The lock transitions to{" "}
                <C>
                  DataPosted
                </C>{" "}
                and the{" "}
                <C>
                  dataDeadline
                </C>{" "}
                is set to{" "}
                <C>
                  now + 120s
                </C>
                .
              </p>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Step 11: Encrypted payload delivery.
                </span>{" "}
                The merchant returns{" "}
                <C>
                  HTTP 200
                </C>{" "}
                with the{" "}
                <C>
                  EncryptedPayload
                </C>{" "}
                (ciphertext, nonce, auth tag, data hash) and an{" "}
                <C>
                  x-payproof-encrypted: true
                </C>{" "}
                header. The agent persists this payload in its local{" "}
                <C>
                  LockStore
                </C>{" "}
                for durability.
              </p>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Steps 12-13: Receipt confirmation.
                </span>{" "}
                The agent independently computes{" "}
                <C>
                  receiptHash = SHA-256(ciphertext)
                </C>{" "}
                from the received encrypted data and calls{" "}
                <C>
                  confirmReceipt(lockId, receiptHash)
                </C>
                . The contract enforces{" "}
                <C>
                  receiptHash == dataHash
                </C>{" "}
                -- if they do not match, the transaction reverts. On success, the
                lock transitions to{" "}
                <C>
                  Confirmed
                </C>
                .
              </p>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Step 14: Claim and decryption.
                </span>{" "}
                The merchant calls{" "}
                <C>
                  claim(lockId, preimage)
                </C>
                . The contract verifies{" "}
                <C>
                  SHA-256(preimage) == hashlock
                </C>
                , transfers the escrowed USDC to the merchant, and emits a{" "}
                <C>
                  Claimed(lockId, preimage)
                </C>{" "}
                event. The agent reads this event from the blockchain, extracts
                the preimage, and uses it as the AES-256-GCM key to decrypt the
                stored{" "}
                <C>
                  EncryptedPayload
                </C>
                . The plaintext data is now available.
              </p>
            </Section>

            {/* ── 6. Failure Modes & Recovery ── */}
            <Section id="failure-modes" title="6. Failure Modes & Recovery">
              <P>
                The protocol is designed so that every failure scenario has a
                well-defined recovery path. No failure can result in permanent
                loss of funds -- every lock eventually resolves to one of the
                three terminal states.
              </P>

              <H3>
                6.1 Failure Scenarios
              </H3>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  1. Merchant never posts dataHash.
                </span>{" "}
                The lock remains in{" "}
                <C>
                  Locked
                </C>{" "}
                state. The agent calls{" "}
                <C>
                  refund()
                </C>{" "}
                after the 300-second timelock expires, recovering the full escrow
                amount. The merchant may have crashed, experienced a network
                failure, or deliberately ghosted -- regardless, the agent&apos;s funds
                are safe.
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  2. Agent never confirms receipt.
                </span>{" "}
                The lock stays in{" "}
                <C>
                  DataPosted
                </C>{" "}
                state. After the{" "}
                <C>
                  dataDeadline
                </C>{" "}
                expires (120 seconds from data post), anyone can call{" "}
                <C>
                  sendToTreasury()
                </C>{" "}
                to move funds to the neutral treasury. The agent does not receive
                a refund -- this prevents strategic non-confirmation.
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  3. postDataHash transaction fails.
                </span>{" "}
                The lock stays in{" "}
                <C>
                  Locked
                </C>{" "}
                state. The server middleware retries the transaction. If it
                continues to fail, the agent refunds after the timelock. The
                encrypted data was prepared but the on-chain commitment could not
                be submitted.
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  4. confirmReceipt transaction fails.
                </span>{" "}
                The lock stays in{" "}
                <C>
                  DataPosted
                </C>{" "}
                state. The client SDK retries with gas estimation. If confirmation
                never succeeds, funds go to treasury after the deadline. The agent
                still has the encrypted payload persisted in{" "}
                <C>
                  LockStore
                </C>{" "}
                for later decryption if the preimage is revealed through other
                means.
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  5. Agent misses Claimed event.
                </span>{" "}
                The lock transitioned to{" "}
                <C>
                  Claimed
                </C>{" "}
                but the agent&apos;s{" "}
                <C>
                  watchForClaim()
                </C>{" "}
                timed out. The preimage is permanently available in on-chain event
                logs. The agent can replay event logs later and decrypt using the
                persisted{" "}
                <C>
                  EncryptedPayload
                </C>
                .
              </p>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  6. Client disconnects mid-flow.
                </span>{" "}
                The server detects the disconnect via{" "}
                <C>
                  AbortSignal
                </C>
                . Recovery depends on the disconnect timing: before lock
                verification, no on-chain state changes exist; after verification
                but before{" "}
                <C>
                  postDataHash
                </C>
                , the lock stays{" "}
                <C>
                  Locked
                </C>{" "}
                and the agent refunds; after{" "}
                <C>
                  postDataHash
                </C>
                , the treasury fallback applies.
              </p>

              <H3>
                6.2 Defense Layers
              </H3>
              <P>
                The protocol employs three defense layers. The first is the{" "}
                <span className="font-medium text-foreground">
                  on-chain state machine
                </span>{" "}
                itself: funds cannot be double-spent, each state transition is
                exclusive, timelocks ensure bounded commitment, and preimage
                verification ensures the merchant can only claim with the real
                key. The second layer is{" "}
                <span className="font-medium text-foreground">
                  SDK safety checks and retry logic
                </span>
                : the server rejects locks with fewer than 120 seconds remaining
                on the timelock to prevent race conditions, the client estimates
                gas before submitting transactions, and event polling uses
                configurable intervals with timeout fallbacks. The third layer is
                the{" "}
                <span className="font-medium text-foreground">
                  client-side LockStore
                </span>
                , which persists lock state and encrypted payloads for offline
                decryption retry, lock status tracking, and automated refund
                sweeping.
              </P>

              <H3>
                6.3 Timing Safety Margins
              </H3>
              <P>
                The normal happy-path execution completes in approximately 25 seconds.
                Two safety boundaries protect against failure: the <C>dataDeadline</C> at
                120 seconds (if data is posted but not confirmed, funds go to treasury) and
                the <C>timelock</C> at 300 seconds (if the merchant never responds, the agent
                can refund). These provide 10x and 20x safety margins respectively,
                ensuring transient network issues do not trigger premature refunds or
                treasury sweeps.
              </P>
            </Section>

            {/* ── 7. Multi-Chain Architecture ── */}
            <Section id="multi-chain" title="7. Multi-Chain Architecture">
              <H3>
                7.1 EVM Implementation
              </H3>
              <P>
                The reference EVM implementation is{" "}
                <C>
                  HTLC.sol
                </C>
                , a Solidity contract of approximately 102 lines. It implements
                the full 7-state machine with the following security properties:
                checks-effects-interactions pattern prevents reentrancy, there are
                no admin functions (no owner, no pause, no upgrade on the core
                contract), the treasury address is immutable (set in the
                constructor), and the contract uses the{" "}
                <C>
                  sha256()
                </C>{" "}
                precompile for all hash operations. Token handling uses{" "}
                <C>
                  IERC20.transferFrom
                </C>{" "}
                for escrow deposits and{" "}
                <C>
                  IERC20.transfer
                </C>{" "}
                for payouts.
              </P>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                The contract stores a{" "}
                <C>
                  Lock
                </C>{" "}
                struct per lock ID containing all 10 protocol fields. Six public
                functions implement the six transitions, and a{" "}
                <C>
                  getLock()
                </C>{" "}
                view function enables cross-party verification. Each transition
                emits an event:{" "}
                <C>
                  Locked
                </C>
                ,{" "}
                <C>
                  DataPosted
                </C>
                ,{" "}
                <C>
                  ReceiptConfirmed
                </C>
                ,{" "}
                <C>
                  Claimed
                </C>
                ,{" "}
                <C>
                  Refunded
                </C>
                , and{" "}
                <C>
                  SentToTreasury
                </C>
                . The{" "}
                <C>
                  Claimed
                </C>{" "}
                event is critical: it includes the preimage, making the
                decryption key permanently available on-chain.
              </p>

              <H3>
                7.2 Chain-Agnostic Design via SHA-256
              </H3>
              <P>
                The protocol is chain-agnostic by construction. The use of
                SHA-256 (rather than chain-native hash functions) means the same
                hashlock can be verified on any blockchain that supports SHA-256
                -- which includes EVM chains, Solana, Cosmos chains, Bitcoin, and
                others. The state machine, game theory, and cryptographic
                construction are independent of the execution environment.
              </P>
              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                The primary deployment target is Circle&apos;s Arc chain, chosen for
                its USDC-native gas model. On Arc, agents only need USDC -- no
                volatile gas token is required. Combined with sub-second finality,
                Arc makes micropayments practical: an agent can pay $0.001 for a
                weather data point without the gas fee exceeding the payment
                amount.
              </p>

              <H3>
                7.3 Solana Readiness
              </H3>
              <P>
                The SDK architecture includes a Solana client module with wallet
                management and HTLC interaction primitives. A Solana program
                (Anchor) implementing the same 7-state machine is included in the
                repository. The SHA-256 hashlock design ensures that a single
                hashlock can span both EVM and Solana locks, enabling future
                cross-chain atomic swaps.
              </P>

              <H3>
                7.4 PayproofRegistry for Upgrades
              </H3>
              <P>
                The{" "}
                <C>
                  PayproofRegistry
                </C>{" "}
                contract maps protocol versions to HTLC contract addresses,
                enabling protocol upgrades without breaking existing locks. The
                server includes{" "}
                <C>
                  extra.protocolVersion
                </C>{" "}
                in the 402 response, and the client SDK checks version
                compatibility before locking funds. Each registry entry contains
                the contract address, an active flag, and a deployment timestamp.
                The registry is owner-controlled and deployed per chain.
              </P>
              <div className="bg-[#1E1E2E] text-[#CDD6F4] rounded-xl p-5 font-mono text-sm overflow-x-auto mt-4">
                <pre>
{`// PayproofRegistry interface
getVersion(version) → { contractAddress, active, deployedAt }
getLatestVersion() → (version, address)
latestVersion() → version`}
                </pre>
              </div>
            </Section>

            {/* ── 8. SDK & Developer Experience ── */}
            <Section id="sdk" title="8. SDK & Developer Experience">
              <H3>
                8.1 Three Packages
              </H3>
              <P>
                The Payproof SDK is organized as a pnpm monorepo with three
                published packages:
              </P>
              <ul className="list-disc pl-6 mt-2 space-y-1 font-sans text-base leading-relaxed text-foreground/80">
                <li>
                  <C>
                    @payproof/contracts
                  </C>{" "}
                  -- shared types, ABIs, chain configurations, and the{" "}
                  <C>
                    LockState
                  </C>{" "}
                  enum
                </li>
                <li>
                  <C>
                    @payproof/client
                  </C>{" "}
                  -- agent-side SDK including x402 handling, EVM/Solana wallet
                  management, HTLC interaction, AES-256-GCM decryption, the
                  LockStore, and auto-refund sweeping
                </li>
                <li>
                  <C>
                    @payproof/server
                  </C>{" "}
                  -- merchant-side SDK including lock verification, data
                  encryption, on-chain commitment, claim orchestration, preimage
                  management, and Next.js middleware adapter
                </li>
              </ul>

              <H3>
                8.2 Factory Pattern
              </H3>
              <P>
                Both the client and server SDKs use a factory pattern for
                initialization. The factories accept per-chain configuration and
                return a fully configured interface with all methods bound to the
                provided chain context.
              </P>
              <div className="bg-[#1E1E2E] text-[#CDD6F4] rounded-xl p-5 font-mono text-sm overflow-x-auto mt-4">
                <pre>
{`// Agent — create a configured client
const client = createPayproofClient({
  evmPrivateKey: "0x...",
  htlcContractAddress: "0x...",
  rpcUrl: "https://rpc.testnet.arc.network",
});

// Merchant — create a configured server
const server = createPayproofServer({
  merchantEvmAddress: "0x...",
  merchantEvmPrivateKey: "0x...",
  htlcContractAddress: "0x...",
});`}
                </pre>
              </div>

              <H3>
                8.3 Middleware Architecture
              </H3>
              <P>
                The server SDK includes a{" "}
                <C>
                  createNextMiddleware()
                </C>{" "}
                adapter that wraps Next.js API routes. The middleware
                intercepts incoming requests, checks for payment headers, returns
                402 responses with payment requirements for unpaid requests, and
                orchestrates the full encrypted flow (verify, encrypt,
                postDataHash, return EncryptedPayload, claim) transparently. The
                route handler itself simply returns plaintext data -- encryption
                and all on-chain operations are handled by the middleware.
              </P>

              <H3>
                8.4 Agent SDK Wraps fetch()
              </H3>
              <P>
                From the agent developer&apos;s perspective, the entire 14-step
                protocol is invisible. The client SDK provides a{" "}
                <C>
                  fetchWithPayment()
                </C>{" "}
                function that wraps the standard{" "}
                <C>
                  fetch()
                </C>{" "}
                API. The agent calls a URL, and the SDK handles the 402
                negotiation, fund locking, receipt confirmation, claim watching,
                and decryption. The return value is a standard{" "}
                <C>
                  Response
                </C>{" "}
                object with plaintext data.
              </P>
              <div className="bg-[#1E1E2E] text-[#CDD6F4] rounded-xl p-5 font-mono text-sm overflow-x-auto mt-4">
                <pre>
{`// Agent: one line — gets plaintext back
const response = await fetchWithPayment(
  "https://api.example.com/weather"
);
const data = await response.json();

// Merchant: route handler returns data normally
export async function GET() {
  const weather = await getWeatherData();
  return Response.json(weather);
}
// Middleware handles everything else automatically`}
                </pre>
              </div>
            </Section>

            {/* ── 9. Competitive Analysis ── */}
            <Section
              id="competitive-analysis"
              title="9. Competitive Analysis"
            >
              <H3>
                9.1 x402 Scheme Comparison
              </H3>
              <P>
                The x402 protocol defines a standard for machine-to-machine
                payments over HTTP. Its{" "}
                <C>
                  exact
                </C>{" "}
                scheme uses Permit2 signatures -- the agent signs an off-chain
                allowance, a trusted facilitator broadcasts the transaction, and
                the server delivers data. Payproof supports the{" "}
                <C>
                  exact
                </C>{" "}
                scheme for backward compatibility and introduces the{" "}
                <C>
                  direct
                </C>{" "}
                scheme for trustless atomic exchange.
              </P>

              <div className="overflow-x-auto mt-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 pr-4 font-medium">Property</th>
                      <th className="text-left py-2 pr-4 font-medium">x402 exact</th>
                      <th className="text-left py-2 font-medium">Payproof direct</th>
                    </tr>
                  </thead>
                  <tbody className="font-sans text-foreground/80">
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Atomicity</td>
                      <td className="py-2 pr-4">None -- pay then hope</td>
                      <td className="py-2">Full -- preimage links payment to decryption</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Trusted third party</td>
                      <td className="py-2 pr-4">Facilitator (x402.org)</td>
                      <td className="py-2">None -- on-chain escrow</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Dispute resolution</td>
                      <td className="py-2 pr-4">None</td>
                      <td className="py-2">Neutral treasury</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Data quality check</td>
                      <td className="py-2 pr-4">Not possible before payment</td>
                      <td className="py-2">Agent confirms before claim</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">On-chain transactions</td>
                      <td className="py-2 pr-4">1 (facilitator broadcasts)</td>
                      <td className="py-2">4 (lock, postDataHash, confirm, claim)</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Latency</td>
                      <td className="py-2 pr-4">~5s (single tx)</td>
                      <td className="py-2">~25s (4 tx, parallelizable)</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Failure recovery</td>
                      <td className="py-2 pr-4">No built-in mechanism</td>
                      <td className="py-2">Timelocks + auto-refund + treasury</td>
                    </tr>
                    <tr className="border-b border-muted">
                      <td className="py-2 pr-4">Cross-chain</td>
                      <td className="py-2 pr-4">Single chain</td>
                      <td className="py-2">SHA-256 hashlocks span chains</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <H3>
                9.2 Relationship to Circle and Arc
              </H3>
              <P>
                Payproof builds on Circle&apos;s infrastructure rather than competing
                with it. USDC is the canonical payment token. Arc is the primary
                deployment chain, chosen for its USDC-native gas model which
                eliminates the need for a volatile gas token -- making
                micropayments practical. Circle provides excellent monetary
                infrastructure (the asset, the chain, the settlement layer) but
                no atomicity layer for data-for-payment. Payproof adds the
                missing piece: the trustless protocol that makes USDC useful for
                autonomous agent commerce where delivery guarantees matter.
              </P>

              <H3>
                9.3 Payproof Extends x402
              </H3>
              <P>
                Payproof does not replace x402 -- it extends it. The 402
                response format, the payment header negotiation, and the
                client/server communication pattern all follow the x402 standard.
                Merchants and agents already using x402 can adopt Payproof&apos;s{" "}
                <C>
                  direct
                </C>{" "}
                scheme incrementally, choosing trust-for-simplicity (exact) or
                cryptography-for-guarantees (direct) on a per-transaction basis.
                The SDK supports both schemes transparently -- a single server can
                offer both to different clients, and a single client can pay via
                either depending on the merchant&apos;s requirements.
              </P>
            </Section>

            {/* ── 10. Roadmap ── */}
            <Section id="roadmap" title="10. Roadmap">
              <P>
                The protocol roadmap is organized in four phases, progressing from
                the current foundation through ecosystem growth to
                standardization.
              </P>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Phase 1: Foundation (current).
                </span>{" "}
                Full 7-state HTLC with AES-256-GCM encryption deployed on Arc
                Testnet. x402 exact scheme compatibility on Base Sepolia. Three
                SDK packages extracted and published. Reference marketplace
                application with AI agent integration, paywalled APIs, and
                multi-chain wallet management.
              </p>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Phase 2: Ecosystem growth.
                </span>{" "}
                Mainnet deployment on Arc. Atomic guarantees applied to the exact
                scheme (preimage revelation on top of Permit2 facilitator flow).
                Onboarding tools including key generation CLI, balance tracking
                dashboard, and wallet setup wizard. Agent tool integrations for
                MCP (Claude), OpenAI function calling, and LangChain.
              </p>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Phase 3: Advanced capabilities.
                </span>{" "}
                Smart contract-driven agentic facilitator replacing the x402.org
                trusted facilitator with permissionless, auditable on-chain
                verification. Opt-in data catalog for programmatic API discovery.
                On-chain reputation system derived from claim/refund/treasury
                ratios. Batch settlements for high-frequency micropayments via
                payment channels. Multi-token support with DEX integration for
                automatic token swaps.
              </p>

              <p className="font-sans text-base leading-relaxed text-foreground/80 mt-4">
                <span className="font-medium text-foreground">
                  Phase 4: Protocol standardization.
                </span>{" "}
                Cross-chain atomic swaps using shared hashlocks across EVM and
                Solana. Subscription and streaming payment channels for real-time
                data feeds. Zero-knowledge privacy layer for shielded transaction
                amounts and anonymous agent identities. Formal specification of
                the Payproof protocol as an RFC-style extension to the x402
                standard, with reference implementations in multiple languages
                and an interoperability testing suite.
              </p>
            </Section>

            {/* ── References ── */}
            <Section id="references" title="References">
              <ol className="list-decimal pl-6 space-y-3 font-sans text-base leading-relaxed text-foreground/80">
                <li>
                  x402 Protocol Specification.{" "}
                  <a
                    href="https://www.x402.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    https://www.x402.org
                  </a>
                </li>
                <li>
                  Poon, J. and Dryja, T. &quot;The Bitcoin Lightning Network:
                  Scalable Off-Chain Instant Payments.&quot; 2016. Hash
                  Time-Locked Contracts (HTLCs) as the foundational primitive for
                  trustless conditional payments.
                </li>
                <li>
                  NIST Special Publication 800-38D. &quot;Recommendation for
                  Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and
                  GMAC.&quot; 2007.{" "}
                  <a
                    href="https://csrc.nist.gov/publications/detail/sp/800-38d/final"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    NIST SP 800-38D
                  </a>
                </li>
                <li>
                  FIPS 180-4. &quot;Secure Hash Standard (SHS).&quot; SHA-256
                  specification used for all hashlock and data commitment
                  operations.{" "}
                  <a
                    href="https://csrc.nist.gov/publications/detail/fips/180/4/final"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    FIPS 180-4
                  </a>
                </li>
                <li>
                  ERC-20 Token Standard. OpenZeppelin implementation used for
                  USDC token handling in HTLC escrow.{" "}
                  <a
                    href="https://eips.ethereum.org/EIPS/eip-20"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    EIP-20
                  </a>
                </li>
                <li>
                  Uniswap Labs. &quot;Permit2.&quot; Signature-based token
                  approval mechanism used by the x402 exact scheme.{" "}
                  <a
                    href="https://github.com/Uniswap/permit2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    github.com/Uniswap/permit2
                  </a>
                </li>
                <li>
                  Circle. &quot;USDC: A Fully Collateralized US Dollar
                  Stablecoin.&quot; The canonical payment token for all Payproof
                  transactions.{" "}
                  <a
                    href="https://www.circle.com/usdc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    circle.com/usdc
                  </a>
                </li>
                <li>
                  Circle Arc. EVM-compatible chain with USDC-native gas, primary
                  deployment target for Payproof.{" "}
                  <a
                    href="https://www.circle.com/arc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    circle.com/arc
                  </a>
                </li>
                <li>
                  Solana Foundation. &quot;Solana: A New Architecture for a High
                  Performance Blockchain.&quot; Target chain for cross-chain HTLC
                  deployment via Anchor framework.{" "}
                  <a
                    href="https://solana.com/solana-whitepaper.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Solana Whitepaper
                  </a>
                </li>
                <li>
                  Payproof Protocol Specification v1.{" "}
                  <a
                    href="https://github.com/lethalazo/payproof"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    github.com/lethalazo/payproof
                  </a>
                </li>
              </ol>
            </Section>

            {/* Footer spacer */}
            <div className="mt-20 pt-8 border-t border-muted">
              <p className="text-sm text-muted-foreground">
                Payproof Protocol v1. Published April 2026 by Discontinuity
                Research.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                This document is the canonical technical specification. For
                implementation details, see the{" "}
                <a
                  href="https://github.com/lethalazo/payproof"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  source repository
                </a>
                .
              </p>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
