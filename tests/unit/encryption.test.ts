import { describe, it, expect } from "vitest";
import {
  encrypt,
  computeSHA256 as serverSHA256,
} from "@payproof/server";
import {
  decrypt,
  computeSHA256 as clientSHA256,
} from "@payproof/client";

describe("Encryption round-trip", () => {
  const samplePreimage = "a".repeat(64); // 32 bytes as hex
  const samplePlaintext = new TextEncoder().encode('{"weather":"sunny","temp":72}');

  it("server encrypt → client decrypt produces original plaintext", async () => {
    const { ciphertext, nonce, authTag } = await encrypt(samplePlaintext, samplePreimage);
    const decrypted = await decrypt(ciphertext, nonce, authTag, samplePreimage);

    expect(new TextDecoder().decode(decrypted)).toBe('{"weather":"sunny","temp":72}');
  });

  it("wrong preimage throws on decrypt", async () => {
    const { ciphertext, nonce, authTag } = await encrypt(samplePlaintext, samplePreimage);

    const wrongPreimage = "b".repeat(64);
    await expect(
      decrypt(ciphertext, nonce, authTag, wrongPreimage),
    ).rejects.toThrow();
  });

  it("computeSHA256 is consistent between server and client packages", async () => {
    const data = new TextEncoder().encode("test data for hashing");
    const serverHash = await serverSHA256(data);
    const clientHash = await clientSHA256(data);

    expect(serverHash).toBe(clientHash);
    expect(serverHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("computeSHA256 is stable (same input → same output)", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const hash1 = await serverSHA256(data);
    const hash2 = await serverSHA256(data);

    expect(hash1).toBe(hash2);
  });
});
