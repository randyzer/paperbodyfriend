export class FetchTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Fetch timed out after ${timeoutMs}ms`);
    this.name = 'FetchTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {},
) {
  const {
    timeoutMs = 5_000,
    fetchImpl = fetch,
    signal,
    ...init
  } = options;

  if (timeoutMs <= 0) {
    return fetchImpl(input, {
      ...init,
      signal,
    });
  }

  const controller = new AbortController();
  let didTimeout = false;

  const handleAbort = () => {
    controller.abort(signal?.reason);
  };

  if (signal?.aborted) {
    handleAbort();
  } else if (signal) {
    signal.addEventListener('abort', handleAbort, { once: true });
  }

  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new FetchTimeoutError(timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeout);

    if (signal) {
      signal.removeEventListener('abort', handleAbort);
    }
  }
}
