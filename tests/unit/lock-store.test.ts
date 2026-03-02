import { describe, it, expect } from "vitest";
import { MemoryLockStore } from "@payproof/client";
import type { PendingLock } from "@payproof/contracts";

function makeLock(overrides: Partial<PendingLock> = {}): PendingLock {
  return {
    lockId: "0x" + "ab".repeat(32),
    network: "eip155:5042002",
    amount: "1000",
    timelock: Math.floor(Date.now() / 1000) + 300,
    createdAt: Date.now(),
    status: "locked",
    ...overrides,
  };
}

describe("MemoryLockStore", () => {
  it("adds and retrieves a lock", () => {
    const store = new MemoryLockStore();
    const lock = makeLock();
    store.add(lock);

    const retrieved = store.get(lock.lockId);
    expect(retrieved).toEqual(lock);
  });

  it("returns undefined for unknown lockId", () => {
    const store = new MemoryLockStore();
    expect(store.get("0x" + "ff".repeat(32))).toBeUndefined();
  });

  it("updates lock status", () => {
    const store = new MemoryLockStore();
    const lock = makeLock();
    store.add(lock);

    store.updateStatus(lock.lockId, "claimed_by_server");
    const updated = store.get(lock.lockId);
    expect(updated?.status).toBe("claimed_by_server");
  });

  it("getAll returns all locks", () => {
    const store = new MemoryLockStore();
    store.add(makeLock({ lockId: "0x01" + "00".repeat(31) }));
    store.add(makeLock({ lockId: "0x02" + "00".repeat(31) }));
    store.add(makeLock({ lockId: "0x03" + "00".repeat(31) }));

    expect(store.getAll()).toHaveLength(3);
  });

  it("getAll with status filter", () => {
    const store = new MemoryLockStore();
    store.add(makeLock({ lockId: "0x01" + "00".repeat(31), status: "locked" }));
    store.add(makeLock({ lockId: "0x02" + "00".repeat(31), status: "settled" }));
    store.add(makeLock({ lockId: "0x03" + "00".repeat(31), status: "locked" }));

    expect(store.getAll("locked")).toHaveLength(2);
    expect(store.getAll("settled")).toHaveLength(1);
    expect(store.getAll("refunded")).toHaveLength(0);
  });
});
