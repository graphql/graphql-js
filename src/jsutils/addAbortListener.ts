type Callback = () => void;
interface AbortInfo {
  listeners: Set<Callback>;
  dispose: Callback;
}
type Cache = WeakMap<AbortSignal, AbortInfo>;

let maybeCache: Cache | undefined;

/**
 * Helper function to add a callback to be triggered when the abort signal fires.
 * Returns a function that will remove the callback when called.
 *
 * This helper function also avoids hitting the max listener limit on AbortSignals,
 * which could be a common occurrence when setting up multiple contingent
 * abort signals.
 */
export function addAbortListener(
  abortSignal: AbortSignal,
  callback: Callback,
): Callback {
  if (abortSignal.aborted) {
    callback();
    return () => {
      /* noop */
    };
  }

  const cache = (maybeCache ??= new WeakMap());

  const abortInfo = cache.get(abortSignal);

  if (abortInfo !== undefined) {
    abortInfo.listeners.add(callback);
    return () => removeAbortListener(abortInfo, callback);
  }

  const listeners = new Set<Callback>([callback]);
  const onAbort = () => triggerCallbacks(listeners);
  const dispose = () => {
    abortSignal.removeEventListener('abort', onAbort);
  };
  const newAbortInfo = { listeners, dispose };
  cache.set(abortSignal, newAbortInfo);
  abortSignal.addEventListener('abort', onAbort);

  return () => removeAbortListener(newAbortInfo, callback);
}

function triggerCallbacks(listeners: Set<Callback>): void {
  for (const listener of listeners) {
    listener();
  }
}

function removeAbortListener(abortInfo: AbortInfo, callback: Callback): void {
  const listeners = abortInfo.listeners;

  listeners.delete(callback);

  if (listeners.size === 0) {
    abortInfo.dispose();
  }
}
