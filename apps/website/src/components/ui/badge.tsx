"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type BadgeVariant = "live" | "ready" | "coming" | "planned";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  animate?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  live: "bg-payment/10 text-payment border-payment/20",
  ready: "bg-chain/10 text-chain border-chain/20",
  coming: "bg-muted text-muted-foreground border-muted",
  planned: "bg-transparent text-muted-foreground border-muted-foreground/30",
};

export function Badge({
  children,
  variant = "live",
  className,
  animate = true,
}: BadgeProps) {
  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium font-sans tracking-wide",
    variantStyles[variant],
    className
  );

  const content = (
    <>
      {variant === "live" && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-payment opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-payment" />
        </span>
      )}
      {children}
    </>
  );

  if (animate) {
    return (
      <motion.span
        className={classes}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
      >
        {content}
      </motion.span>
    );
  }

  return <span className={classes}>{content}</span>;
}
