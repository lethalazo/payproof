/** Store interface for HTLC preimage/hashlock management. */
export interface PreimageStore {
  generateHashlock(): Promise<{ preimage: string; hashlock: string }>;
  getPreimage(hashlock: string): string | null | Promise<string | null>;
  consumePreimage(hashlock: string): string | null | Promise<string | null>;
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface SecretEntry {
  preimage: string;
  createdAt: number;
}

/** In-memory PreimageStore with configurable TTL. */
export class MemoryPreimageStore implements PreimageStore {
  private secrets = new Map<string, SecretEntry>();
  private ttlMs: number;

  constructor(ttlMs = 30 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  async generateHashlock(): Promise<{ preimage: string; hashlock: string }> {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const preimage = toHex(bytes);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const hashlock = "0x" + toHex(new Uint8Array(hash));
    this.secrets.set(hashlock, { preimage, createdAt: Date.now() });
    return { preimage, hashlock };
  }

  getPreimage(hashlock: string): string | null {
    const entry = this.secrets.get(hashlock);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.secrets.delete(hashlock);
      return null;
    }
    return entry.preimage;
  }

  consumePreimage(hashlock: string): string | null {
    const preimage = this.getPreimage(hashlock);
    if (preimage) {
      this.secrets.delete(hashlock);
    }
    return preimage;
  }
}
