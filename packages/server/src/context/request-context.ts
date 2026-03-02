import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  signal: AbortSignal;
}

const requestStore = new AsyncLocalStorage<RequestContext>();

/** Run a function within a request context (signal scoped per-request). */
export function runWithRequestContext<T>(
  ctx: RequestContext,
  fn: () => T,
): T {
  return requestStore.run(ctx, fn);
}

/** Check if the current request's client has disconnected. */
export function isClientDisconnected(): boolean {
  return requestStore.getStore()?.signal.aborted ?? false;
}
