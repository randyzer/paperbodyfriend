const CREEM_LIVE_API_BASE_URL = 'https://api.creem.io';
const CREEM_TEST_API_BASE_URL = 'https://test-api.creem.io';

type CreateCheckoutRequest = {
  apiKey: string;
  testMode: boolean;
  productId: string;
  requestId: string;
  successUrl: string;
  email: string;
  units: number;
  metadata: Record<string, string>;
};

type CreateCheckoutResponse = {
  id: string;
  checkout_url: string;
  product_id?: string;
  status: string;
  mode?: 'test' | 'live';
};

function getApiBaseUrl(testMode: boolean) {
  return testMode ? CREEM_TEST_API_BASE_URL : CREEM_LIVE_API_BASE_URL;
}

function readErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error;
  }

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message;
  }

  return null;
}

export async function createCreemCheckoutSession(
  input: CreateCheckoutRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  checkoutId: string;
  checkoutUrl: string;
  status: string;
  mode: 'test' | 'live';
}> {
  const response = await fetchImpl(`${getApiBaseUrl(input.testMode)}/v1/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': input.apiKey,
    },
    body: JSON.stringify({
      product_id: input.productId,
      request_id: input.requestId,
      success_url: input.successUrl,
      units: input.units,
      customer: {
        email: input.email,
      },
      metadata: input.metadata,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => null)) as
    | CreateCheckoutResponse
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload) ?? 'Creem checkout request failed');
  }

  const checkoutId =
    (payload && 'id' in payload && typeof payload.id === 'string' && payload.id) || null;
  const checkoutUrl =
    (payload &&
      'checkout_url' in payload &&
      typeof payload.checkout_url === 'string' &&
      payload.checkout_url) ||
    null;
  const status =
    (payload &&
      'status' in payload &&
      typeof payload.status === 'string' &&
      payload.status) ||
    'pending';
  const mode: 'test' | 'live' =
    (payload &&
      'mode' in payload &&
      (payload.mode === 'test' || payload.mode === 'live') &&
      payload.mode) ||
    (input.testMode ? 'test' : 'live');

  if (!checkoutId || !checkoutUrl) {
    throw new Error('Creem checkout response missing id or checkout_url');
  }

  return {
    checkoutId,
    checkoutUrl,
    status,
    mode,
  };
}
