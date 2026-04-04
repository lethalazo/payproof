import { cn } from "@/lib/utils";

interface OrbConfig {
  color: string;
  size: string;
  position: string;
  animation: string;
  blur?: string;
  opacity?: string;
}

const presets: Record<string, OrbConfig[]> = {
  hero: [
    { color: "bg-agent", size: "w-96 h-96", position: "-top-40 -left-20", animation: "animate-float-slow", blur: "blur-[120px]", opacity: "opacity-20" },
    { color: "bg-crypto", size: "w-80 h-80", position: "top-20 -right-20", animation: "animate-float-medium", blur: "blur-[100px]", opacity: "opacity-15" },
    { color: "bg-payment", size: "w-72 h-72", position: "bottom-10 left-1/3", animation: "animate-float-fast", blur: "blur-[100px]", opacity: "opacity-15" },
  ],
  problem: [
    { color: "bg-problem", size: "w-80 h-80", position: "-top-20 -right-20", animation: "animate-float-slow", blur: "blur-[120px]", opacity: "opacity-10" },
    { color: "bg-problem", size: "w-64 h-64", position: "bottom-0 -left-10", animation: "animate-float-medium", blur: "blur-[100px]", opacity: "opacity-8" },
  ],
  solution: [
    { color: "bg-crypto", size: "w-96 h-96", position: "-top-20 left-1/4", animation: "animate-float-slow", blur: "blur-[130px]", opacity: "opacity-15" },
    { color: "bg-payment", size: "w-80 h-80", position: "bottom-0 right-1/4", animation: "animate-float-medium", blur: "blur-[120px]", opacity: "opacity-15" },
  ],
  protocol: [
    { color: "bg-agent", size: "w-72 h-72", position: "-top-10 -left-10", animation: "animate-float-fast", blur: "blur-[100px]", opacity: "opacity-10" },
    { color: "bg-merchant", size: "w-64 h-64", position: "top-1/3 -right-10", animation: "animate-float-slow", blur: "blur-[100px]", opacity: "opacity-10" },
    { color: "bg-chain", size: "w-72 h-72", position: "bottom-0 left-1/3", animation: "animate-float-medium", blur: "blur-[100px]", opacity: "opacity-10" },
  ],
  arc: [
    { color: "bg-chain", size: "w-96 h-96", position: "-top-20 left-1/4", animation: "animate-float-slow", blur: "blur-[130px]", opacity: "opacity-12" },
    { color: "bg-payment", size: "w-80 h-80", position: "bottom-10 right-1/4", animation: "animate-float-medium", blur: "blur-[120px]", opacity: "opacity-12" },
  ],
  crypto: [
    { color: "bg-crypto", size: "w-80 h-80", position: "-top-10 right-1/4", animation: "animate-float-slow", blur: "blur-[120px]", opacity: "opacity-15" },
    { color: "bg-agent", size: "w-64 h-64", position: "bottom-10 -left-10", animation: "animate-float-fast", blur: "blur-[100px]", opacity: "opacity-10" },
  ],
};

interface GradientOrbsProps {
  preset: keyof typeof presets;
  className?: string;
}

export function GradientOrbs({ preset, className }: GradientOrbsProps) {
  const orbs = presets[preset] || presets.hero;

  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      {orbs.map((orb, i) => (
        <div
          key={i}
          className={cn(
            "absolute rounded-full",
            orb.color,
            orb.size,
            orb.position,
            orb.animation,
            orb.blur || "blur-[100px]",
            orb.opacity || "opacity-15"
          )}
        />
      ))}
    </div>
  );
}
