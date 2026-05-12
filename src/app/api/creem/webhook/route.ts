import { getCreemService } from '@/server/creem/default-creem-service';
import { createCreemRouteHandlers } from '@/server/creem/route-handlers';
import { verifyCreemWebhookSignature } from '@/server/creem/signatures';
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
    async getCurrentUser() {
      throw new Error('Not used in webhook route');
    },
    getConfig: getCreemConfig,
    verifyWebhookSignature: verifyCreemWebhookSignature,
    creemService: getCreemService(),
    logError(message, error) {
      console.error(message, error);
    },
  }).webhook(request);
}
