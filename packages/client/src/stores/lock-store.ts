import type { PendingLock } from "@payproof/contracts";

/** Store interface for tracking HTLC locks created by the agent. */
export interface LockStore {
  add(lock: PendingLock): void | Promise<void>;
  get(lockId: string): PendingLock | undefined | Promise<PendingLock | undefined>;
  updateStatus(lockId: string, status: PendingLock["status"]): void | Promise<void>;
  getAll(filter?: PendingLock["status"]): PendingLock[] | Promise<PendingLock[]>;
}

/** In-memory LockStore. */
export class MemoryLockStore implements LockStore {
  private locks = new Map<string, PendingLock>();

  add(lock: PendingLock): void {
    this.locks.set(lock.lockId, lock);
  }

  get(lockId: string): PendingLock | undefined {
    return this.locks.get(lockId);
  }

  updateStatus(lockId: string, status: PendingLock["status"]): void {
    const lock = this.locks.get(lockId);
    if (lock) lock.status = status;
  }

  getAll(filter?: PendingLock["status"]): PendingLock[] {
    const all = Array.from(this.locks.values());
    if (filter) return all.filter((l) => l.status === filter);
    return all;
  }
}
