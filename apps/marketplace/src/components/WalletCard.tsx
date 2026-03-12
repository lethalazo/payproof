"use client";

interface WalletCardProps {
  name: string;
  address: string;
  balance: string;
  symbol: string;
  explorer: string;
  accent: "blue" | "purple" | "orange";
}

const LOW_BALANCE_THRESHOLD = 0.01;

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

const FAUCET_LINKS: Record<string, { url: string; label: string }> = {
  "Base Sepolia": {
    url: "https://faucet.circle.com/",
    label: "Circle Faucet",
  },
  "Arc Testnet": {
    url: "https://faucet.circle.com/",
    label: "Circle Faucet",
  },
  "Solana Devnet": {
    url: "https://faucet.circle.com/",
    label: "Circle Faucet",
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
  const balanceNum = parseFloat(balance);
  const isLowBalance = !isNaN(balanceNum) && balanceNum < LOW_BALANCE_THRESHOLD && balance !== "error";
  const faucet = FAUCET_LINKS[name];

  const truncated =
    address === "not configured" || address.length < 10
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
      <div className="flex items-center justify-between">
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
        {faucet && (
          <a
            href={faucet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
          >
            {faucet.label}
          </a>
        )}
      </div>
      {isLowBalance && (
        <div className="mt-2 text-[11px] text-amber-400 flex items-center gap-1">
          <span>&#9888;</span>
          Low balance — get testnet USDC from the faucet
        </div>
      )}
    </div>
  );
}
