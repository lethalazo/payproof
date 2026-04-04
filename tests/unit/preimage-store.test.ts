import { describe, it, expect } from "vitest";
import { MemoryPreimageStore } from "@payproof/server";

describe("MemoryPreimageStore", () => {
  it("generates hashlock in correct format", async () => {
    const store = new MemoryPreimageStore();
    const { preimage, hashlock } = await store.generateHashlock();

    // Preimage is 64 hex chars (32 bytes)
    expect(preimage).toMatch(/^[0-9a-f]{64}$/);
    // Hashlock is 0x-prefixed 64 hex chars
    expect(hashlock).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("retrieves preimage by hashlock", async () => {
    const store = new MemoryPreimageStore();
    const { preimage, hashlock } = await store.generateHashlock();

    const retrieved = store.getPreimage(hashlock);
    expect(retrieved).toBe(preimage);
  });

  it("returns null for unknown hashlock", () => {
    const store = new MemoryPreimageStore();
    const result = store.getPreimage("0x" + "aa".repeat(32));
    expect(result).toBeNull();
  });

  it("expires entries after TTL", async () => {
    const store = new MemoryPreimageStore(50); // 50ms TTL
    const { hashlock } = await store.generateHashlock();

    expect(store.getPreimage(hashlock)).not.toBeNull();

    await new Promise((r) => setTimeout(r, 80));

    expect(store.getPreimage(hashlock)).toBeNull();
  });

  it("consumePreimage atomically retrieves and deletes the entry", async () => {
    const store = new MemoryPreimageStore();
    const { preimage, hashlock } = await store.generateHashlock();

    const consumed = store.consumePreimage(hashlock);
    expect(consumed).toBe(preimage);

    // Entry IS deleted — consumePreimage prevents double-use of the preimage.
    // The preimage is passed explicitly to claimAfterConfirmation after consumption.
    expect(store.getPreimage(hashlock)).toBeNull();
    expect(store.consumePreimage(hashlock)).toBeNull();
  });

  it("SHA-256(preimage) equals hashlock", async () => {
    const store = new MemoryPreimageStore();
    const { preimage, hashlock } = await store.generateHashlock();

    // Manually compute SHA-256 of preimage bytes
    const preimageBytes = new Uint8Array(
      preimage.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
    );
    const hash = await crypto.subtle.digest("SHA-256", preimageBytes);
    const hashHex =
      "0x" +
      Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    expect(hashHex).toBe(hashlock);
  });
});
