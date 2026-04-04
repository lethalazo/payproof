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

/** In-memory PreimageStore with configurable TTL and periodic sweep. */
export class MemoryPreimageStore implements PreimageStore {
  private secrets = new Map<string, SecretEntry>();
  private ttlMs: number;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs = 30 * 60 * 1000) {
    this.ttlMs = ttlMs;

    // Sweep expired entries every 5 minutes to prevent memory accumulation
    this.sweepTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.secrets) {
        if (now - entry.createdAt > this.ttlMs) this.secrets.delete(key);
      }
    }, 5 * 60 * 1000);
    // Allow Node to exit without waiting for this timer
    if (this.sweepTimer.unref) this.sweepTimer.unref();
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
