"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { SectionWrapper } from "@/components/section-wrapper";
import { GradientOrbs } from "@/components/animations/gradient-orbs";
import { EASE_OUT_EXPO } from "@/lib/motion";

/* ------------------------------------------------------------------ */
/*  Step data                                                          */
/* ------------------------------------------------------------------ */

const steps = [
  {
    num: 1,
    label: "Lock",
    color: "agent",
    description:
      "Agent escrows USDC in an on-chain HTLC against the merchant\u2019s hashlock.",
  },
  {
    num: 2,
    label: "Encrypt",
    color: "merchant",
    description:
      "Merchant encrypts data with the preimage as AES-256-GCM key, commits hash on-chain.",
  },
  {
    num: 3,
    label: "Confirm",
    color: "chain",
    description:
      "Agent verifies the data commitment and confirms receipt on-chain.",
  },
  {
    num: 4,
    label: "Claim",
    color: "payment",
    description:
      "Merchant reveals the preimage to claim payment \u2014 the key is now public.",
  },
  {
    num: 5,
    label: "Decrypt",
    color: "crypto",
    description:
      "Agent reads the preimage from chain and decrypts. Payment and data delivery: atomic.",
  },
] as const;

const colorMap: Record<string, string> = {
  agent: "bg-agent",
  merchant: "bg-merchant",
  chain: "bg-chain",
  payment: "bg-payment",
  crypto: "bg-crypto",
};

/* ------------------------------------------------------------------ */
/*  SVG State Machine diagram                                          */
/* ------------------------------------------------------------------ */

interface StateNodeProps {
  x: number;
  y: number;
  width: number;
  label: string;
  fill: string;
  stroke: string;
  textColor: string;
  delay: number;
  isInView: boolean;
}

function StateNode({ x, y, width, label, fill, stroke, textColor, delay, isInView }: StateNodeProps) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay, ease: EASE_OUT_EXPO }}
      style={{ transformOrigin: `${x + width / 2}px ${y + 18}px` }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={36}
        rx={8}
        fill={fill}
        fillOpacity={0.12}
        stroke={stroke}
        strokeWidth={2}
        strokeOpacity={0.6}
      />
      <text
        x={x + width / 2}
        y={y + 18}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontFamily="var(--font-sans)"
        fontWeight={600}
        fill={textColor}
      >
        {label}
      </text>
    </motion.g>
  );
}

const smNodes = [
  { x: 10, label: "Empty", fill: "var(--muted-foreground)", stroke: "var(--muted-foreground)", text: "var(--muted-foreground)" },
  { x: 140, label: "Locked", fill: "var(--agent)", stroke: "var(--agent)", text: "var(--agent)" },
  { x: 270, label: "DataPosted", fill: "var(--merchant)", stroke: "var(--merchant)", text: "var(--merchant)" },
  { x: 415, label: "Confirmed", fill: "var(--chain)", stroke: "var(--chain)", text: "var(--chain)" },
  { x: 560, label: "Claimed", fill: "var(--payment)", stroke: "var(--payment)", text: "var(--payment)" },
];

const smBranch = [
  { x: 140, label: "Refunded", fill: "var(--muted-foreground)", stroke: "var(--muted-foreground)", text: "var(--muted-foreground)" },
  { x: 270, label: "Treasury", fill: "var(--problem)", stroke: "var(--problem)", text: "var(--problem)" },
];

const smHArrows = [
  { x1: 110, x2: 140, delay: 0.5 },
  { x1: 240, x2: 270, delay: 0.6 },
  { x1: 380, x2: 415, delay: 0.7 },
  { x1: 525, x2: 560, delay: 0.8 },
];

const smVArrows = [
  { x: 190, y1: 66, y2: 140, delay: 0.9 },
  { x: 320, y1: 66, y2: 140, delay: 1.0 },
];

function StateMachine() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <div ref={ref} className="mt-12 flex justify-center">
      <svg viewBox="0 0 700 200" className="w-full max-w-4xl" fill="none">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
          </marker>
        </defs>

        {/* Top-row state nodes */}
        {smNodes.map((n, i) => (
          <StateNode
            key={n.label}
            x={n.x}
            y={30}
            width={100}
            label={n.label}
            fill={n.fill}
            stroke={n.stroke}
            textColor={n.text}
            delay={i * 0.1}
            isInView={isInView}
          />
        ))}

        {/* Branch nodes */}
        {smBranch.map((n, i) => (
          <StateNode
            key={n.label}
            x={n.x}
            y={140}
            width={100}
            label={n.label}
            fill={n.fill}
            stroke={n.stroke}
            textColor={n.text}
            delay={0.9 + i * 0.1}
            isInView={isInView}
          />
        ))}

        {/* Horizontal arrows */}
        {smHArrows.map((a, i) => (
          <motion.line
            key={`h-${i}`}
            x1={a.x1}
            y1={48}
            x2={a.x2}
            y2={48}
            stroke="var(--muted-foreground)"
            strokeWidth={2}
            strokeLinecap="round"
            markerEnd="url(#arrow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 0.6 } : {}}
            transition={{ duration: 0.4, delay: a.delay, ease: "easeOut" }}
          />
        ))}

        {/* Vertical arrows to branch nodes */}
        {smVArrows.map((a, i) => (
          <motion.line
            key={`v-${i}`}
            x1={a.x}
            y1={a.y1}
            x2={a.x}
            y2={a.y2}
            stroke="var(--muted-foreground)"
            strokeWidth={2}
            strokeLinecap="round"
            markerEnd="url(#arrow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 0.5 } : {}}
            transition={{ duration: 0.4, delay: a.delay, ease: "easeOut" }}
          />
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step card (non-expandable)                                         */
/* ------------------------------------------------------------------ */

function StepCard({
  step,
  index,
}: {
  step: (typeof steps)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const bgClass = colorMap[step.color];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: EASE_OUT_EXPO,
      }}
    >
      <div className="bg-white/60 border border-muted rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-white font-sans text-sm font-bold",
              bgClass
            )}
          >
            {step.num}
          </div>

          {/* Label + description */}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg font-medium text-foreground">
              {step.label}
            </h3>
            <p className="font-sans text-sm text-muted-foreground mt-0.5 leading-relaxed">
              {step.description}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  How It Works section                                               */
/* ------------------------------------------------------------------ */

export function HowItWorks() {
  return (
    <SectionWrapper id="how-it-works" className="py-24 md:py-32">
      <GradientOrbs preset="protocol" />

      <div className="relative z-10 max-w-4xl mx-auto px-6">
        {/* Heading */}
        <h2 className="font-serif text-3xl md:text-5xl text-center text-foreground">
          Five steps. Thirty seconds. Zero trust.
        </h2>

        {/* State machine visualization */}
        <StateMachine />

        {/* Step cards */}
        <div className="mt-16 space-y-4">
          {steps.map((step, i) => (
            <StepCard key={step.num} step={step} index={i} />
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
