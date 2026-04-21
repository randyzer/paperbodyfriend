import assert from 'node:assert/strict';

async function main() {
  const { FetchTimeoutError, fetchWithTimeout } = await import(
    '../src/lib/fetch-with-timeout'
  );

  let aborted = false;
  const hangingFetch: typeof fetch = (_input, init) => {
    init?.signal?.addEventListener('abort', () => {
      aborted = true;
    });

    return new Promise<Response>(() => undefined);
  };

  await assert.rejects(
    () =>
      fetchWithTimeout('http://example.com', {
        timeoutMs: 20,
        fetchImpl: hangingFetch,
      }),
    (error: unknown) => {
      assert.ok(error instanceof FetchTimeoutError);
      return true;
    },
  );
  assert.equal(aborted, true);

  let observedSignalReceived = false;
  let observedAborted: boolean | null = null;
  const successfulFetch: typeof fetch = async (_input, init) => {
    observedSignalReceived = Boolean(init?.signal);
    observedAborted = init?.signal?.aborted ?? null;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const response = await fetchWithTimeout('http://example.com', {
    timeoutMs: 100,
    fetchImpl: successfulFetch,
  });
  assert.equal(response.status, 200);
  assert.equal(observedSignalReceived, true);
  assert.equal(observedAborted, false);

  console.log('fetch with timeout test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
