"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { SectionWrapper } from "@/components/section-wrapper";
import { GradientOrbs } from "@/components/animations/gradient-orbs";
import { EASE_OUT_EXPO } from "@/lib/motion";

/* ═══════════════════════════════════════════════════════════════
   Icon 1 - Payment Before Delivery
   viewBox 0 0 80 56, two tracks with arrows
   ═══════════════════════════════════════════════════════════════ */
function PaymentBeforeDeliveryIcon() {
  /*
    viewBox 0 0 80 56 - two parallel horizontal tracks:
      Top track (y=16): emerald arrow travels right → succeeds (payment goes)
      Bottom track (y=40): orange arrow travels left → hits red barrier (data blocked)
      Red barrier is a vertical wall at x≈40 on the bottom track only
  */
  return (
    <svg viewBox="0 0 80 56" className="w-20 h-14" fill="none">
      {/* ── Top track: emerald payment arrow → succeeds ───── */}
      <motion.g
        whileInView={{ x: [0, 36], opacity: [0, 1, 1, 0.4] }}
        viewport={{ once: false }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
      >
        <rect x={2} y={13} width={24} height={6} rx={2} fill="var(--payment)" fillOpacity={0.12} />
        <line x1={4} y1={16} x2={22} y2={16} stroke="var(--payment)" strokeWidth={2.5} strokeLinecap="round" />
        <polygon points="22,11 30,16 22,21" fill="var(--payment)" />
      </motion.g>

      {/* ── Bottom track: orange data arrow ← hits barrier ── */}
      {/* Arrow starts at right, moves left 8px then stops at barrier (tip reaches x=42) */}
      <motion.g
        whileInView={{ x: [0, -10], opacity: [0, 1, 1, 1] }}
        viewport={{ once: false }}
        transition={{ duration: 1.2, delay: 0.8, repeat: Infinity, repeatDelay: 2, ease: "easeOut" }}
      >
        <rect x={52} y={37} width={24} height={6} rx={2} fill="var(--merchant)" fillOpacity={0.12} />
        <line x1={74} y1={40} x2={56} y2={40} stroke="var(--merchant)" strokeWidth={2.5} strokeLinecap="round" />
        <polygon points="56,35 48,40 56,45" fill="var(--merchant)" />
      </motion.g>

      {/* ── Red barrier wall (further left, on bottom track) */}
      <rect
        x={33} y={32} width={4} height={16} rx={1.5}
        fill="var(--problem)" fillOpacity={0.25}
        stroke="var(--problem)" strokeWidth={1.5}
      />

      {/* ── Red X - appears when arrow hits barrier ──────── */}
      <motion.g
        whileInView={{ scale: [0, 1.15, 1], opacity: [0, 1, 1] }}
        viewport={{ once: false }}
        transition={{ duration: 0.3, delay: 1.6, repeat: Infinity, repeatDelay: 2.9, ease: "easeOut" }}
        style={{ transformOrigin: "35px 40px" }}
      >
        <line x1={31} y1={37} x2={39} y2={43} stroke="var(--problem)" strokeWidth={1.8} strokeLinecap="round" />
        <line x1={39} y1={37} x2={31} y2={43} stroke="var(--problem)" strokeWidth={1.8} strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Icon 2 - Trusted Facilitators
   viewBox 0 0 72 72, center circle + 6 inward arrows
   ═══════════════════════════════════════════════════════════════ */
const r = (n: number) => Math.round(n * 100) / 100; // avoid SSR/client float drift

const facilitatorArrows = [0, 60, 120, 180, 240, 300].map((angle) => {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ox = r(36 + cos * 32);
  const oy = r(36 + sin * 32);
  const ix = r(36 + cos * 16);
  const iy = r(36 + sin * 16);
  const backX = ix + r(cos * 5);
  const backY = iy + r(sin * 5);
  const perpX = r(-sin);
  const perpY = r(cos);
  return {
    angle,
    ox, oy, ix, iy,
    a1x: r(backX + perpX * 4), a1y: r(backY + perpY * 4),
    a2x: r(backX - perpX * 4), a2y: r(backY - perpY * 4),
  };
});

function TrustedFacilitatorsIcon() {
  return (
    <svg viewBox="0 0 72 72" className="w-[4.5rem] h-[4.5rem]" fill="none">
      <circle
        cx={36}
        cy={36}
        r={14}
        fill="var(--problem)"
        fillOpacity={0.15}
        stroke="var(--problem)"
        strokeWidth={2.5}
      />

      {facilitatorArrows.map((a, i) => (
          <motion.g
            key={a.angle}
            whileInView={{ opacity: [0.15, 0.9, 0.15] }}
            viewport={{ once: false }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut",
            }}
          >
            <line
              x1={a.ox}
              y1={a.oy}
              x2={a.ix}
              y2={a.iy}
              stroke="var(--problem)"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <polygon
              points={`${a.ix},${a.iy} ${a.a1x},${a.a1y} ${a.a2x},${a.a2y}`}
              fill="var(--problem)"
            />
          </motion.g>
        ))}

      {/* Center dot - pulses */}
      <motion.circle
        cx={36}
        cy={36}
        r={5}
        fill="var(--problem)"
        whileInView={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
        viewport={{ once: false }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ transformOrigin: "36px 36px" }}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Icon 3 - No Recourse
   viewBox 0 0 72 72, $ circle dissolves → particles → ? appears
   ═══════════════════════════════════════════════════════════════ */
const scatterParticles = [
  { angle: 30, dist: 24 },
  { angle: 95, dist: 20 },
  { angle: 160, dist: 26 },
  { angle: 210, dist: 22 },
  { angle: 275, dist: 25 },
  { angle: 340, dist: 21 },
].map((p) => {
  const rad = (p.angle * Math.PI) / 180;
  return { endX: r(36 + Math.cos(rad) * p.dist), endY: r(36 + Math.sin(rad) * p.dist) };
});

function NoRecourseIcon() {
  const TOTAL = 4.5;

  return (
    <svg viewBox="0 0 72 72" className="w-[4.5rem] h-[4.5rem]" fill="none">
      {/* Phase 1: $ circle - shrinks to 0 */}
      <motion.circle
        cx={36}
        cy={36}
        r={16}
        fill="var(--payment)"
        fillOpacity={0.2}
        stroke="var(--payment)"
        strokeWidth={2.5}
        whileInView={{ r: [16, 16, 0], opacity: [1, 1, 0] }}
        viewport={{ once: false }}
        transition={{
          duration: TOTAL,
          repeat: Infinity,
          times: [0, 0.3, 0.5],
          ease: "easeIn",
        }}
      />

      <motion.text
        x={36}
        y={41}
        textAnchor="middle"
        fontSize={14}
        fontFamily="var(--font-sans)"
        fontWeight={700}
        fill="var(--payment)"
        whileInView={{ opacity: [1, 1, 0], scale: [1, 1, 0.3] }}
        viewport={{ once: false }}
        transition={{
          duration: TOTAL,
          repeat: Infinity,
          times: [0, 0.3, 0.5],
          ease: "easeIn",
        }}
        style={{ transformOrigin: "36px 36px" }}
      >
        $
      </motion.text>

      {/* Phase 2: Particles scatter outward and fade */}
      {scatterParticles.map((p, i) => (
          <motion.circle
            key={i}
            r={2}
            fill="var(--payment)"
            whileInView={{
              cx: [36, 36, p.endX, p.endX],
              cy: [36, 36, p.endY, p.endY],
              opacity: [0, 0, 0.8, 0],
            }}
            viewport={{ once: false }}
            transition={{
              duration: TOTAL,
              repeat: Infinity,
              times: [0, 0.45, 0.65, 0.75],
              ease: "easeOut",
            }}
          />
        ))}

      {/* Phase 3: ? appears in problem color */}
      <motion.text
        x={36}
        y={43}
        textAnchor="middle"
        fontSize={22}
        fontFamily="var(--font-serif)"
        fontWeight={400}
        fill="var(--problem)"
        whileInView={{
          opacity: [0, 0, 0, 1, 1, 0],
          scale: [0.3, 0.3, 0.3, 1.15, 1, 1],
        }}
        viewport={{ once: false }}
        transition={{
          duration: TOTAL,
          repeat: Infinity,
          times: [0, 0.55, 0.65, 0.75, 0.9, 1],
          ease: "easeOut",
        }}
        style={{ transformOrigin: "36px 36px" }}
      >
        ?
      </motion.text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Card data
   ═══════════════════════════════════════════════════════════════ */
const cards = [
  {
    icon: <PaymentBeforeDeliveryIcon />,
    title: "Payment before delivery",
    copy: "Agents sign irrevocable payments before any data arrives. At machine speed, hope is not a strategy.",
  },
  {
    icon: <TrustedFacilitatorsIcon />,
    title: "Trusted facilitators",
    copy: "A single entity controls settlement \u2014 with the power to steal, censor, or front-run every transaction.",
  },
  {
    icon: <NoRecourseIcon />,
    title: "No recourse",
    copy: "When the merchant ghosts, the payment is gone. No dispute. No refund. No resolution.",
  },
];

/* ═══════════════════════════════════════════════════════════════
   Problem section
   ═══════════════════════════════════════════════════════════════ */
export function Problem() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <SectionWrapper id="protocol" className="py-24 md:py-32">
      <GradientOrbs preset="problem" />

      <div className="relative mx-auto max-w-7xl px-6">
        <h2 className="font-serif text-3xl md:text-5xl text-foreground">
          Agents can&apos;t call customer support.
        </h2>
        <p className="font-sans text-lg text-muted-foreground mt-4 max-w-2xl">
          Current payment protocols assume a human is watching. Autonomous agents
          need cryptographic guarantees, not terms of service.
        </p>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              className="bg-problem-light/50 border border-problem/10 rounded-2xl p-6"
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.15, ease: EASE_OUT_EXPO }}
            >
              <div className="mb-6 flex items-center justify-start h-16">
                {card.icon}
              </div>
              <h3 className="font-serif text-xl text-foreground">{card.title}</h3>
              <p className="font-sans text-sm text-muted-foreground mt-3 leading-relaxed">
                {card.copy}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
