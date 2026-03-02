import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@payproof/contracts": resolve(__dirname, "packages/contracts/dist/index.js"),
      "@payproof/server": resolve(__dirname, "packages/server/dist/index.js"),
      "@payproof/client": resolve(__dirname, "packages/client/dist/index.js"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
