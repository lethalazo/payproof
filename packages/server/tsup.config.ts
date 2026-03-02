import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/next.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    "@solana/web3.js",
    "@solana/spl-token",
    "next",
    "next/server",
    "@x402/next",
  ],
});
