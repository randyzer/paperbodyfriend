interface PollUntilOptions {
  intervalMs: number;
  maxAttempts: number;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function pollUntil<T>(
  operation: (attempt: number) => Promise<T>,
  isDone: (result: T) => boolean,
  options: PollUntilOptions,
): Promise<T> {
  let lastResult: T | undefined;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    lastResult = await operation(attempt);

    if (isDone(lastResult)) {
      return lastResult;
    }

    if (attempt < options.maxAttempts) {
      await sleep(options.intervalMs);
    }
  }

  return lastResult as T;
}
