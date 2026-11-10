// A fetch that gives up after `ms`. With weak or no signal a request can hang
// for minutes instead of failing (over a VPN, indefinitely), and anything
// waiting on it hangs too, even after the signal comes back. Failing on time
// lets callers show "check your signal" and retry cleanly.
export function withTimeout(ms: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    // Respect a caller's own cancel, too.
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) controller.abort();
      else outer.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Rejects if `promise` takes longer than `ms`. For waits that aren't a fetch. */
export function timeLimit<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out')), ms); }),
  ]).finally(() => clearTimeout(timer));
}
