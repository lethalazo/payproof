"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { SectionWrapper } from "@/components/section-wrapper";
import { EASE_OUT_EXPO } from "@/lib/motion";

/* ------------------------------------------------------------------ */
/*  Roadmap data — 2 phases only                                       */
/* ------------------------------------------------------------------ */

interface Phase {
  name: string;
  title: string;
  version: string;
  current?: boolean;
  dotColor: string;
  items: string[];
}

const phases: Phase[] = [
  {
    name: "Phase 1",
    title: "Foundation",
    version: "v0.1",
    current: true,
    dotColor: "bg-payment border-payment",
    items: [
      "Atomic payment protocol on Arc Testnet",
      "SDK published",
      "Reference marketplace",
      "Full protocol spec",
    ],
  },
  {
    name: "Phase 2",
    title: "Developer Experience",
    version: "",
    dotColor: "bg-agent border-agent",
    items: [
      "Arc mainnet deployment",
      "CLI tooling",
      "MCP + OpenAI + LlamaIndex integrations",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Phase component                                                    */
/* ------------------------------------------------------------------ */

function PhaseBlock({ phase, index }: { phase: Phase; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      className="relative pl-10 pb-12 last:pb-0"
      initial={{ opacity: 0, x: -10 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{
        duration: 0.5,
        delay: index * 0.15,
        ease: EASE_OUT_EXPO,
      }}
    >
      {/* Dot */}
      <div className="absolute left-0 top-1 flex items-center justify-center">
        <div
          className={cn("w-4 h-4 rounded-full border-2 z-10", phase.dotColor)}
        />
        {phase.current && (
          <span className="absolute w-4 h-4 rounded-full border-2 border-payment animate-ping opacity-40" />
        )}
      </div>

      {/* Content */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-sans text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {phase.name}
            {phase.version ? ` — ${phase.version}` : ""}
          </span>
          {phase.current && (
            <span className="text-[10px] font-sans font-medium bg-payment/10 text-payment rounded-full px-2 py-0.5">
              Live
            </span>
          )}
        </div>
        <h3 className="font-serif text-lg mt-1">{phase.title}</h3>
        <ul className="mt-3 space-y-2">
          {phase.items.map((item, i) => (
            <motion.li
              key={i}
              className="text-sm text-muted-foreground font-sans flex items-start gap-2"
              initial={{ opacity: 0, x: -5 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{
                duration: 0.3,
                delay: index * 0.15 + i * 0.05,
                ease: EASE_OUT_EXPO,
              }}
            >
              <span className="text-muted-foreground/40 mt-1 shrink-0">
                &bull;
              </span>
              {item}
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Roadmap section                                                    */
/* ------------------------------------------------------------------ */

export function Roadmap() {
  const lineRef = useRef<HTMLDivElement>(null);
  const lineInView = useInView(lineRef, { once: true, margin: "-80px" });

  return (
    <SectionWrapper id="roadmap" className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="font-serif text-3xl md:text-5xl text-center">
          Where we are. Where we&apos;re going.
        </h2>

        <div ref={lineRef} className="relative mt-16 max-w-2xl mx-auto">
          {/* Vertical line that grows on scroll */}
          <motion.div
            className="absolute left-[7px] top-0 w-0.5 bg-muted origin-top"
            initial={{ scaleY: 0 }}
            animate={lineInView ? { scaleY: 1 } : {}}
            transition={{ duration: 1.2, ease: EASE_OUT_EXPO }}
            style={{ height: "100%" }}
          />

          {/* Phases */}
          {phases.map((phase, i) => (
            <PhaseBlock key={phase.name} phase={phase} index={i} />
          ))}
        </div>

        {/* Full roadmap link */}
        <p className="text-center mt-10">
          <a
            href="/whitepaper/#roadmap"
            className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            See the full roadmap in our whitepaper{" "}
            <span aria-hidden="true">&rarr;</span>
          </a>
        </p>
      </div>
    </SectionWrapper>
  );
}
