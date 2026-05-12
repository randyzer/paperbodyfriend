import { NextResponse } from 'next/server';

type BillingStatusResponse = {
  active: boolean;
  productId: string | null;
  subscriptionStatus: string | null;
  checkoutStatus: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  currentPeriodEnd: Date | null;
};

type CreemRouteDeps = {
  getCurrentUser(request: Request): Promise<{
    id: string;
    email: string;
  }>;
  getConfig(): {
    apiKey: string | null;
    webhookSecret: string | null;
    productId: string | null;
    appBaseUrl: string | null;
    testMode: boolean;
  };
  verifyWebhookSignature(
    rawBody: string,
    signature: string | null | undefined,
    secret: string,
  ): boolean;
  creemService: {
    createCheckoutSession(input: {
      userId: string;
      email: string;
      productId: string;
      apiKey: string;
      appBaseUrl: string;
      testMode: boolean;
      units: number;
    }): Promise<{
      checkoutId: string;
      checkoutUrl: string;
      requestId: string;
      status: string;
      mode: 'test' | 'live';
    }>;
    getBillingStatus(userId: string): Promise<BillingStatusResponse>;
    handleWebhook(input: {
      rawBody: string;
      webhookSecret: string;
      signature: string;
    }): Promise<void>;
  };
  logError(message: string, error: unknown): void;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function internalError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export function createCreemRouteHandlers(deps: CreemRouteDeps) {
  return {
    async checkout(request: Request) {
      let body: unknown;

      try {
        body = await readJsonBody(request);
      } catch (error) {
        if (error instanceof Error && error.message === 'Invalid JSON body') {
          return badRequest(error.message);
        }

        deps.logError('Creem checkout 读取请求体失败：', error);
        return internalError('Checkout service unavailable');
      }

      const units =
        body &&
        typeof body === 'object' &&
        Number.isInteger((body as { units?: unknown }).units)
          ? Number((body as { units?: number }).units)
          : 1;

      if (units <= 0) {
        return badRequest('units must be a positive integer');
      }

      const config = deps.getConfig();
      if (!config.apiKey || !config.productId || !config.appBaseUrl) {
        return internalError('Creem server configuration missing');
      }

      try {
        const user = await deps.getCurrentUser(request);
        const checkout = await deps.creemService.createCheckoutSession({
          userId: user.id,
          email: user.email,
          productId: config.productId,
          apiKey: config.apiKey,
          appBaseUrl: config.appBaseUrl,
          testMode: config.testMode,
          units,
        });

        return NextResponse.json(checkout, { status: 201 });
      } catch (error) {
        deps.logError('Creem checkout 创建失败：', error);
        return internalError('Checkout service unavailable');
      }
    },

    async status(request: Request) {
      try {
        const user = await deps.getCurrentUser(request);
        return NextResponse.json(await deps.creemService.getBillingStatus(user.id));
      } catch (error) {
        deps.logError('Creem billing status 获取失败：', error);
        return internalError('Billing service unavailable');
      }
    },

    async webhook(request: Request) {
      const webhookSecret = deps.getConfig().webhookSecret;
      if (!webhookSecret) {
        return internalError('Creem webhook secret missing');
      }

      const rawBody = await request.text();
      const signature = request.headers.get('creem-signature');
      if (!deps.verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        return internalError('Invalid webhook signature', 401);
      }

      try {
        await deps.creemService.handleWebhook({
          rawBody,
          signature: signature ?? '',
          webhookSecret,
        });

        return NextResponse.json({ received: true });
      } catch (error) {
        deps.logError('Creem webhook 处理失败：', error);
        return internalError('Webhook processing failed');
      }
    },
  };
}
