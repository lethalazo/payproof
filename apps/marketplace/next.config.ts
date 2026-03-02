import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "bs58",
    "base-x",
    "safe-buffer",
    "@solana/web3.js",
    "@solana/spl-token",
  ],
};

export default nextConfig;
