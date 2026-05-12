import { requireAuthenticatedUser } from '@/server/auth/request-auth';
import { getCreemService } from '@/server/creem/default-creem-service';
import { createCreemRouteHandlers } from '@/server/creem/route-handlers';
import { getServerEnv } from '@/server/env';

export const runtime = 'nodejs';

function getCreemConfig() {
  const env = getServerEnv();

  return {
    apiKey: env.CREEM_API_KEY ?? null,
    webhookSecret: env.CREEM_WEBHOOK_SECRET ?? null,
    productId: env.CREEM_PRODUCT_ID ?? null,
    appBaseUrl: env.APP_BASE_URL ?? null,
    testMode: env.CREEM_TEST_MODE
      ? env.CREEM_TEST_MODE === 'true'
      : process.env.NODE_ENV !== 'production',
  };
}

export async function POST(request: Request) {
  return createCreemRouteHandlers({
    async getCurrentUser(innerRequest) {
      return requireAuthenticatedUser(innerRequest);
    },
    getConfig: getCreemConfig,
    verifyWebhookSignature() {
      return false;
    },
    creemService: getCreemService(),
    logError(message, error) {
      console.error(message, error);
    },
  }).checkout(request);
}
