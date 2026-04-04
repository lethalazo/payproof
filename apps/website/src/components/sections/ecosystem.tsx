"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { SectionWrapper } from "@/components/section-wrapper";
import { Badge } from "@/components/ui/badge";
import { GradientOrbs } from "@/components/animations/gradient-orbs";
import { EASE_OUT_EXPO } from "@/lib/motion";

/* ------------------------------------------------------------------ */
/*  Section 1: Chain logo row                                          */
/* ------------------------------------------------------------------ */

const logoChains = [
  { name: "Circle USDC", color: "bg-payment", text: "text-payment", duration: 5, badge: null },
  { name: "Arc", color: "bg-chain", text: "text-chain", duration: 7, badge: { label: "Primary", variant: "live" as const } },
  { name: "Base", color: "bg-chain", text: "text-chain", duration: 6, badge: { label: "x402", variant: "ready" as const } },
  { name: "Solana", color: "bg-crypto", text: "text-crypto", duration: 8, badge: { label: "SDK Ready", variant: "ready" as const } },
  { name: "Ethereum", color: "bg-muted-foreground", text: "text-muted-foreground", duration: 9, badge: { label: "Planned", variant: "planned" as const } },
];

function ChainLogoRow() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
      className="mt-12 flex flex-wrap items-center justify-center gap-6 md:gap-10"
    >
      {logoChains.map((chain) => (
        <motion.div
          key={chain.name}
          whileInView={{ y: [0, -5, 0] }}
          viewport={{ once: false }}
          transition={{ duration: chain.duration, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <span className={cn("font-sans text-sm font-semibold", chain.text)}>
            {chain.name}
          </span>
          {chain.badge && (
            <Badge variant={chain.badge.variant}>{chain.badge.label}</Badge>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 2: Wallet comparison                                       */
/* ------------------------------------------------------------------ */

function WalletComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.2, ease: EASE_OUT_EXPO }}
      className="mt-12 max-w-xl mx-auto"
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Arc card */}
        <div
          className="relative rounded-xl bg-white/60 border border-muted border-t-4 border-t-payment p-6"
          style={{
            boxShadow: "0 0 20px 2px hsl(var(--payment) / 0.12)",
          }}
        >
          <h4 className="font-sans text-sm font-semibold text-foreground mb-4">
            Arc
          </h4>
          <div className="font-mono text-sm text-foreground">
            <span className="text-payment font-medium">USDC</span> $10.00
          </div>
        </div>

        {/* Other chains card */}
        <div className="rounded-xl bg-white/60 border border-muted border-t-4 border-t-muted p-6 opacity-70">
          <h4 className="font-sans text-sm font-semibold text-foreground mb-4">
            Other chains
          </h4>
          <div className="font-mono text-sm text-foreground">
            <span className="text-muted-foreground font-medium">USDC</span>{" "}
            $10.00
          </div>
          <div className="font-mono text-sm text-muted-foreground mt-1">
            <span className="text-muted-foreground font-medium">ETH</span>{" "}
            $0.05 <span className="text-xs">(gas)</span>
          </div>
        </div>
      </div>

      <p className="text-center font-serif italic text-muted-foreground mt-6">
        One token. Gas and payments. No volatility.
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 3: Supported chains grid                                   */
/* ------------------------------------------------------------------ */

interface SupportedChain {
  initial: string;
  name: string;
  scheme: string;
  badgeVariant: "live" | "ready" | "coming" | "planned";
  badgeLabel: string;
  fill: string;
}

const supportedChains: SupportedChain[] = [
  {
    initial: "A",
    name: "Arc Testnet",
    scheme: "Atomic",
    badgeVariant: "live",
    badgeLabel: "Live",
    fill: "bg-chain text-white",
  },
  {
    initial: "B",
    name: "Base Sepolia",
    scheme: "Permit2 (x402)",
    badgeVariant: "live",
    badgeLabel: "Live",
    fill: "bg-chain text-white",
  },
  {
    initial: "S",
    name: "Solana Devnet",
    scheme: "Atomic",
    badgeVariant: "ready",
    badgeLabel: "SDK Ready",
    fill: "bg-crypto text-white",
  },
  {
    initial: "A",
    name: "Arc Mainnet",
    scheme: "Atomic",
    badgeVariant: "coming",
    badgeLabel: "Coming Soon",
    fill: "bg-chain/20 text-chain",
  },
  {
    initial: "E",
    name: "Ethereum",
    scheme: "Atomic",
    badgeVariant: "planned",
    badgeLabel: "Planned",
    fill: "bg-muted-foreground text-white",
  },
];

function SupportedChainsGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(gridRef, { once: true, margin: "-80px" });

  return (
    <div
      ref={gridRef}
      className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto"
    >
      {supportedChains.map((chain, i) => (
        <motion.div
          key={chain.name}
          className="bg-white/50 border border-muted rounded-xl p-4 flex items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.5,
            delay: i * 0.1,
            ease: EASE_OUT_EXPO,
          }}
        >
          {/* Small circle */}
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-sans font-bold shrink-0",
              chain.fill
            )}
          >
            {chain.initial}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-sans text-sm font-medium text-foreground">
                {chain.name}
              </span>
              <Badge variant={chain.badgeVariant} animate={false}>
                {chain.badgeLabel}
              </Badge>
            </div>
            <span className="font-mono text-xs text-muted-foreground mt-0.5 block">
              {chain.scheme}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ecosystem section (merges arc-native + chains)                     */
/* ------------------------------------------------------------------ */

export function Ecosystem() {
  return (
    <SectionWrapper id="chains" className="py-20 md:py-28">
      <GradientOrbs preset="arc" />

      <div className="relative z-10 max-w-4xl mx-auto px-6">
        {/* Heading */}
        <h2 className="font-serif text-3xl md:text-5xl text-center text-foreground">
          Built on Circle. Multi-chain by design.
        </h2>
        <p className="font-sans text-lg text-muted-foreground text-center mt-4 max-w-2xl mx-auto">
          USDC-native gas on Arc. Same protocol across every EVM chain.
        </p>

        {/* Chain logo row */}
        <ChainLogoRow />

        {/* Wallet comparison */}
        <WalletComparison />

        {/* Supported chains grid */}
        <SupportedChainsGrid />
      </div>
    </SectionWrapper>
  );
}
