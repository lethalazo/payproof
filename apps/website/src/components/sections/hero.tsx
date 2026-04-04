"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "@/components/section-wrapper";
import { Button } from "@/components/ui/button";
import { GradientOrbs } from "@/components/animations/gradient-orbs";
import { EASE_OUT_EXPO } from "@/lib/motion";

/* ── Node data ────────────────────────────────────────────────── */
const nodes = [
  { id: "agent", label: "Agent", cx: 80, cy: 80, color: "var(--agent)" },
  { id: "merchant", label: "Merchant", cx: 320, cy: 80, color: "var(--merchant)" },
  { id: "chain", label: "Chain", cx: 200, cy: 260, color: "var(--chain)" },
] as const;

/* ── Connection lines — computed edge-to-edge from circle centers ── */
const R = 30;
function edgePts(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  return {
    x1: Math.round(ax + ux * R),
    y1: Math.round(ay + uy * R),
    x2: Math.round(bx - ux * R),
    y2: Math.round(by - uy * R),
  };
}

const lines = [
  { id: "am", ...edgePts(80, 80, 320, 80), color: "var(--agent)", delay: 0 },
  { id: "ma", ...edgePts(320, 80, 80, 80), color: "var(--merchant)", delay: 1.5, dashed: true },
  { id: "ac", ...edgePts(80, 80, 200, 260), color: "var(--payment)", delay: 3 },
  { id: "cm", ...edgePts(200, 260, 320, 80), color: "var(--crypto)", delay: 4.5 },
  { id: "ca", ...edgePts(200, 260, 80, 80), color: "var(--payment)", delay: 4.5 },
];

const CYCLE = 1.2;
const REPEAT_DELAY = 5;

/* Precomputed traveling dot keyframes per line */
const dotKeyframes = lines.map((line) => ({
  cx: [line.x1, line.x2, line.x2, line.x1],
  cy: [line.y1, line.y2, line.y2, line.y1],
  opacity: [0, 0.9, 0.9, 0] as number[],
}));

function ProtocolVisualization() {
  return (
    <div className="relative w-full max-w-md mx-auto aspect-[400/320] flex items-center justify-center">
      <svg viewBox="0 0 400 320" className="w-full h-full" fill="none">
        {/* ── Defs: glow filter ──────────────────────────────── */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Connection lines ───────────────────────────────── */}
        {lines.map((line) => (
          <motion.line
            key={line.id}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={"dashed" in line && line.dashed ? "6 4" : undefined}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: [0, 1, 1, 0],
              opacity: [0, 0.8, 0.8, 0],
            }}
            transition={{
              duration: CYCLE,
              delay: line.delay,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: REPEAT_DELAY,
            }}
          />
        ))}

        {/* ── Traveling dots ─────────────────────────────────── */}
        {lines.map((line, i) => (
          <motion.circle
            key={`dot-${line.id}`}
            r={4}
            fill={line.color}
            filter="url(#glow)"
            initial={{ opacity: 0 }}
            animate={dotKeyframes[i]}
            transition={{
              duration: CYCLE,
              delay: line.delay,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: REPEAT_DELAY,
            }}
          />
        ))}

        {/* ── Nodes ──────────────────────────────────────────── */}
        {nodes.map((node, i) => (
          <motion.g key={node.id}>
            {/* Pulse ring */}
            <motion.circle
              cx={node.cx}
              cy={node.cy}
              r={34}
              stroke={node.color}
              strokeWidth={2}
              fill="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.3, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.8,
                ease: "easeInOut",
              }}
            />

            {/* Outer circle — filled */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r={30}
              fill={node.color}
              fillOpacity={0.12}
              stroke={node.color}
              strokeWidth={2.5}
            />

            {/* Inner dot */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r={6}
              fill={node.color}
            />

            {/* Label */}
            <text
              x={node.cx}
              y={node.cy + 48}
              textAnchor="middle"
              fontSize={13}
              fontFamily="var(--font-sans)"
              fontWeight={500}
              letterSpacing="0.03em"
              fill={node.color}
            >
              {node.label}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

export function Hero() {
  return (
    <SectionWrapper className="min-h-screen pt-24">
      <GradientOrbs preset="hero" />

      <div className="relative mx-auto max-w-7xl px-6 flex flex-col lg:flex-row items-center gap-12 lg:gap-8 py-12 md:py-20">
        <div className="w-full lg:w-[55%] flex flex-col">
          <motion.h1
            className="font-serif text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
          >
            The only trustless payment protocol for autonomous agents.
          </motion.h1>

          <motion.p
            className="font-sans text-lg text-muted-foreground mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE_OUT_EXPO }}
          >
            Atomic. Non-custodial. Permissionless.
          </motion.p>

          <motion.p
            className="font-sans text-base text-muted-foreground/80 mt-6 max-w-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE_OUT_EXPO }}
          >
            The HTLC preimage that unlocks payment{" "}
            <strong className="italic">is</strong> the encryption key for the
            data. Neither party can cheat.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease: EASE_OUT_EXPO }}
          >
            <Button href="/whitepaper/">Read the Whitepaper</Button>
            <Button variant="secondary" href="https://github.com/lethalazo/payproof">
              View on GitHub
            </Button>
          </motion.div>

          <motion.div
            className="mt-12 flex items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            <span className="text-xs text-muted-foreground/60 tracking-wider uppercase font-sans">
              Built on
            </span>
            {["Circle USDC", "Arc", "x402"].map((label) => (
              <span
                key={label}
                className="text-xs text-muted-foreground/60 tracking-wider uppercase font-sans"
              >
                {label}
              </span>
            ))}
          </motion.div>
        </div>

        <div className="w-full lg:w-[45%] flex items-center justify-center">
          <motion.div
            className="w-full max-w-sm lg:max-w-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: EASE_OUT_EXPO }}
          >
            <ProtocolVisualization />
          </motion.div>
        </div>
      </div>
    </SectionWrapper>
  );
}
