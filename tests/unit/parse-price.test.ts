import { describe, it, expect } from "vitest";
import { DirectTransferServer, MemoryPreimageStore } from "@payproof/server";
import { USDC_ASSETS } from "@payproof/contracts";

function makeServer() {
  return new DirectTransferServer({
    htlcContractAddress: "0x" + "00".repeat(20),
    preimageStore: new MemoryPreimageStore(),
  });
}

describe("DirectTransferServer.parsePrice", () => {
  const server = makeServer();

  it('parses "$0.001" to 1000 micro-USDC', async () => {
    const result = await server.parsePrice("$0.001", "eip155:5042002");
    expect(result.amount).toBe("1000");
  });

  it('parses "$0.01" to 10000 micro-USDC', async () => {
    const result = await server.parsePrice("$0.01", "eip155:5042002");
    expect(result.amount).toBe("10000");
  });

  it('parses "$0.05" to 50000 micro-USDC', async () => {
    const result = await server.parsePrice("$0.05", "eip155:5042002");
    expect(result.amount).toBe("50000");
  });

  it('parses "$1.00" to 1000000 micro-USDC', async () => {
    const result = await server.parsePrice("$1.00", "eip155:5042002");
    expect(result.amount).toBe("1000000");
  });

  it("parses numeric input", async () => {
    const result = await server.parsePrice(0.001, "eip155:5042002");
    expect(result.amount).toBe("1000");
  });

  it("passes through AssetAmount unchanged", async () => {
    const input = { asset: "0xabc", amount: "42" };
    const result = await server.parsePrice(input, "eip155:5042002");
    expect(result).toEqual(input);
  });

  it("throws for unsupported network", async () => {
    await expect(
      server.parsePrice("$1.00", "eip155:99999" as any),
    ).rejects.toThrow("unsupported network");
  });

  it("returns correct USDC asset address per chain", async () => {
    const arcResult = await server.parsePrice("$1.00", "eip155:5042002");
    expect(arcResult.asset).toBe(USDC_ASSETS["eip155:5042002"].address);

    const solResult = await server.parsePrice("$1.00", "solana:devnet");
    expect(solResult.asset).toBe(USDC_ASSETS["solana:devnet"].address);
  });
});
