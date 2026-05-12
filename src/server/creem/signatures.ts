import crypto from 'node:crypto';

type CreemReturnParams = {
  checkout_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  subscription_id: string | null;
  product_id: string | null;
  request_id?: string | null;
  signature: string | null;
};

function safeEqualHex(left: string, right: string) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function buildSortedPairs(
  params: Omit<CreemReturnParams, 'signature'>,
) {
  return Object.keys(params)
    .filter(key => {
      const value = params[key as keyof typeof params];
      return value !== null && value !== undefined && value !== '';
    })
    .sort()
    .map(key => `${key}=${params[key as keyof typeof params]}`);
}

function buildLegacyPairsFromObject(
  params: Omit<CreemReturnParams, 'signature'>,
) {
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`);
}

function buildLegacyPairsFromSearchParams(searchParams: URLSearchParams) {
  const pairs: string[] = [];

  for (const [key, value] of searchParams.entries()) {
    if (key === 'signature' || value === '' || value === 'null') {
      continue;
    }

    pairs.push(`${key}=${value}`);
  }

  return pairs;
}

export function verifyCreemReturnSignature(
  params: CreemReturnParams,
  apiKey: string,
) {
  if (!params.signature || !apiKey) {
    return false;
  }

  const { signature, ...rest } = params;
  const sortedPairs = buildSortedPairs(rest);
  const payload = sortedPairs.join('&');

  const expectedHmac = crypto
    .createHmac('sha256', apiKey)
    .update(payload)
    .digest('hex');

  if (safeEqualHex(signature, expectedHmac)) {
    return true;
  }

  const expectedLegacy = crypto
    .createHash('sha256')
    .update([...buildLegacyPairsFromObject(rest), `salt=${apiKey}`].join('|'))
    .digest('hex');

  return safeEqualHex(signature, expectedLegacy);
}

export function verifyCreemReturnSignatureFromSearchParams(
  searchParams: URLSearchParams,
  apiKey: string,
) {
  const signature = searchParams.get('signature');
  if (!signature || !apiKey) {
    return false;
  }

  const sortedPairs = Array.from(searchParams.entries())
    .filter(([key, value]) => key !== 'signature' && value !== '' && value !== 'null')
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`);

  const expectedHmac = crypto
    .createHmac('sha256', apiKey)
    .update(sortedPairs.join('&'))
    .digest('hex');

  if (safeEqualHex(signature, expectedHmac)) {
    return true;
  }

  const expectedLegacy = crypto
    .createHash('sha256')
    .update([...buildLegacyPairsFromSearchParams(searchParams), `salt=${apiKey}`].join('|'))
    .digest('hex');

  return safeEqualHex(signature, expectedLegacy);
}

export function verifyCreemWebhookSignature(
  payload: string,
  signature: string | null | undefined,
  webhookSecret: string,
) {
  if (!signature || !webhookSecret) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return safeEqualHex(signature, expected);
}
