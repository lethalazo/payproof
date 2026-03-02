"use client";

interface WalletCardProps {
  name: string;
  address: string;
  balance: string;
  symbol: string;
  explorer: string;
  accent: "blue" | "purple" | "orange";
}

const ACCENT_CLASSES: Record<string, { border: string; dot: string }> = {
  blue: {
    border: "border-blue-500/30 bg-blue-950/20",
    dot: "bg-blue-400",
  },
  purple: {
    border: "border-purple-500/30 bg-purple-950/20",
    dot: "bg-purple-400",
  },
  orange: {
    border: "border-orange-500/30 bg-orange-950/20",
    dot: "bg-orange-400",
  },
};

export default function WalletCard({
  name,
  address,
  balance,
  symbol,
  explorer,
  accent,
}: WalletCardProps) {
  const styles = ACCENT_CLASSES[accent] || ACCENT_CLASSES.blue;

  const truncated =
    address === "not configured"
      ? address
      : `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className={`rounded-lg border p-4 ${styles.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
        <span className="text-sm font-medium text-gray-300">{name}</span>
      </div>
      <div className="text-2xl font-bold text-white mb-1">
        {balance === "error" ? "—" : `${balance} ${symbol}`}
      </div>
      {explorer ? (
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-300 font-mono transition-colors"
        >
          {truncated}
        </a>
      ) : (
        <span className="text-xs text-gray-500 font-mono">{truncated}</span>
      )}
    </div>
  );
}
