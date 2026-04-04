"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { SectionWrapper } from "@/components/section-wrapper";
import { GradientOrbs } from "@/components/animations/gradient-orbs";
import { EASE_OUT_EXPO } from "@/lib/motion";

/* ------------------------------------------------------------------ */
/*  Animated "preimage = key" illustration                              */
/* ------------------------------------------------------------------ */

function KeyIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  /* Traveling dot keyframes along bezier approximation */
  const leftDotPath = {
    cx: [250, 225, 190, 170, 160],
    cy: [80, 100, 120, 140, 155],
  };
  const rightDotPath = {
    cx: [350, 375, 410, 430, 440],
    cy: [80, 100, 120, 140, 155],
  };

  return (
    <div ref={ref} className="relative w-full max-w-3xl mx-auto">
      <svg viewBox="0 0 600 340" className="w-full" fill="none">
        {/* ---- Defs: glow filters ---- */}
        <defs>
          <filter id="glow-green">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ---- Center preimage hex ---- */}
        <motion.rect
          x={220}
          y={30}
          width={160}
          height={30}
          rx={15}
          fill="var(--crypto)"
          fillOpacity={0.08}
          stroke="var(--crypto)"
          strokeOpacity={0.2}
          strokeWidth={1.5}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
        <motion.text
          x={300}
          y={50}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-mono"
          fontSize={14}
          fontFamily="var(--font-mono)"
          fontWeight={500}
          fill="var(--crypto)"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          0x7f3a...d2e8
        </motion.text>

        <motion.text
          x={300}
          y={75}
          textAnchor="middle"
          fontSize={11}
          fontFamily="var(--font-sans)"
          fill="var(--muted-foreground)"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 0.7 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          32-byte preimage
        </motion.text>

        {/* ---- Left fork: HTLC Escrow (payment / emerald) ---- */}
        <motion.path
          d="M 250 80 C 250 115, 160 125, 160 155"
          stroke="var(--payment)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 1, delay: 0.8, ease: "easeInOut" }}
        />

        {/* Traveling dot — left */}
        <motion.circle
          r={4}
          fill="var(--payment)"
          initial={{ opacity: 0, cx: 250, cy: 80 }}
          animate={
            isInView
              ? { opacity: [0, 1, 1, 1, 0], cx: leftDotPath.cx, cy: leftDotPath.cy }
              : {}
          }
          transition={{ duration: 1.2, delay: 1.3, ease: "easeInOut" }}
        />

        {/* Left lock icon */}
        <motion.g
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 1.8 }}
          style={{ transformOrigin: "160px 188px" }}
        >
          {/* Lock body */}
          <rect
            x={142}
            y={175}
            width={36}
            height={28}
            rx={5}
            fill="var(--payment)"
            fillOpacity={0.35}
            stroke="var(--payment)"
            strokeWidth={2}
          />
          <path
            d="M 151 175 L 151 164 A 9 9 0 0 1 169 164 L 169 175"
            stroke="var(--payment)"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={160} cy={189} r={3.5} fill="var(--payment)" fillOpacity={0.8} />
        </motion.g>

        {/* "HTLC Escrow" label */}
        <motion.text
          x={160}
          y={225}
          textAnchor="middle"
          fontSize={12}
          fontFamily="var(--font-sans)"
          fontWeight={600}
          fill="var(--payment)"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 2.2 }}
        >
          HTLC Escrow
        </motion.text>

        {/* USDC badge */}
        <motion.g
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 2.2 }}
        >
          <rect
            x={130}
            y={235}
            width={60}
            height={24}
            rx={12}
            fill="var(--payment)"
            fillOpacity={0.12}
            stroke="var(--payment)"
            strokeOpacity={0.3}
            strokeWidth={1}
          />
          <text
            x={160}
            y={251}
            textAnchor="middle"
            fontSize={11}
            fontFamily="var(--font-sans)"
            fontWeight={600}
            fill="var(--payment)"
          >
            USDC
          </text>
        </motion.g>

        {/* ---- Right fork: AES-256-GCM (crypto / violet) ---- */}
        <motion.path
          d="M 350 80 C 350 115, 440 125, 440 155"
          stroke="var(--crypto)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 1, delay: 0.8, ease: "easeInOut" }}
        />

        {/* Traveling dot — right */}
        <motion.circle
          r={4}
          fill="var(--crypto)"
          initial={{ opacity: 0, cx: 350, cy: 80 }}
          animate={
            isInView
              ? { opacity: [0, 1, 1, 1, 0], cx: rightDotPath.cx, cy: rightDotPath.cy }
              : {}
          }
          transition={{ duration: 1.2, delay: 1.3, ease: "easeInOut" }}
        />

        {/* Right lock icon */}
        <motion.g
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 1.8 }}
          style={{ transformOrigin: "440px 188px" }}
        >
          <rect
            x={422}
            y={175}
            width={36}
            height={28}
            rx={5}
            fill="var(--crypto)"
            fillOpacity={0.35}
            stroke="var(--crypto)"
            strokeWidth={2}
          />
          <path
            d="M 431 175 L 431 164 A 9 9 0 0 1 449 164 L 449 175"
            stroke="var(--crypto)"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={440} cy={189} r={3.5} fill="var(--crypto)" fillOpacity={0.8} />
        </motion.g>

        {/* "AES-256-GCM" label */}
        <motion.text
          x={440}
          y={225}
          textAnchor="middle"
          fontSize={12}
          fontFamily="var(--font-sans)"
          fontWeight={600}
          fill="var(--crypto)"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 2.2 }}
        >
          AES-256-GCM
        </motion.text>

        {/* Data badge */}
        <motion.g
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 2.2 }}
        >
          <rect
            x={414}
            y={235}
            width={52}
            height={24}
            rx={12}
            fill="var(--crypto)"
            fillOpacity={0.12}
            stroke="var(--crypto)"
            strokeOpacity={0.3}
            strokeWidth={1}
          />
          <text
            x={440}
            y={251}
            textAnchor="middle"
            fontSize={11}
            fontFamily="var(--font-sans)"
            fontWeight={600}
            fill="var(--crypto)"
          >
            Data
          </text>
        </motion.g>

        {/* ---- Convergence dashed paths ---- */}
        <motion.path
          d="M 160 259 C 160 280, 240 290, 300 300"
          stroke="var(--payment)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="4 3"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isInView ? { pathLength: 1, opacity: 0.6 } : {}}
          transition={{ duration: 0.8, delay: 2.6, ease: "easeInOut" }}
        />
        <motion.path
          d="M 440 259 C 440 280, 360 290, 300 300"
          stroke="var(--crypto)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="4 3"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isInView ? { pathLength: 1, opacity: 0.6 } : {}}
          transition={{ duration: 0.8, delay: 2.6, ease: "easeInOut" }}
        />

        {/* ---- Checkmark at center ---- */}
        <motion.g
          initial={{ opacity: 0, scale: 0 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ type: "spring", stiffness: 300, damping: 15, delay: 3.2 }}
          style={{ transformOrigin: "300px 305px" }}
          filter="url(#glow-green)"
        >
          <circle
            cx={300}
            cy={305}
            r={16}
            fill="var(--payment)"
            fillOpacity={1}
            stroke="var(--payment)"
            strokeWidth={2.5}
          />
          <polyline
            points="291,305 297,312 310,298"
            stroke="#d1fae5"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </motion.g>

        <motion.text
          x={300}
          y={335}
          textAnchor="middle"
          fontSize={13}
          fontFamily="var(--font-sans)"
          fontWeight={600}
          fill="var(--payment)"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 3.4 }}
        >
          Atomic
        </motion.text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Solution section                                                   */
/* ------------------------------------------------------------------ */

export function Solution() {
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const summaryInView = useInView(summaryRef, { once: true, margin: "-60px" });

  return (
    <SectionWrapper className="py-24 md:py-32">
      <GradientOrbs preset="solution" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Heading */}
        <h2 className="font-serif text-3xl md:text-5xl text-center text-foreground">
          The key that pays is the key that decrypts.
        </h2>
        <p className="font-serif italic text-xl md:text-2xl text-muted-foreground text-center mt-4">
          One secret. Two purposes. Zero trust.
        </p>

        {/* Animated illustration */}
        <div className="mt-16">
          <KeyIllustration />
        </div>

        {/* Single summary sentence */}
        <motion.p
          ref={summaryRef}
          className="text-center text-muted-foreground text-base md:text-lg max-w-3xl mx-auto mt-12 leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          animate={summaryInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
        >
          The merchant can only get paid by revealing the decryption key. The
          agent can only decrypt after confirming receipt. Atomic by
          construction.
        </motion.p>
      </div>
    </SectionWrapper>
  );
}
