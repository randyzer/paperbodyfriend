import assert from 'node:assert/strict';

async function main() {
  const { createCreemRouteHandlers } = await import(
    '../src/server/creem/route-handlers'
  );

  let webhookCalls = 0;
  let checkoutCalls = 0;
  let statusCalls = 0;
  let checkoutShouldFail = false;
  let webhookShouldFail = false;

  const handlers = createCreemRouteHandlers({
    async getCurrentUser() {
      return {
        id: 'user_1',
        email: 'user@example.com',
      };
    },
    getConfig() {
      return {
        apiKey: 'creem_api_key',
        webhookSecret: 'whsec_test',
        productId: 'prod_123',
        appBaseUrl: 'https://paperboyfriend.shop',
        testMode: true,
      };
    },
    verifyWebhookSignature(rawBody, signature, secret) {
      return (
        rawBody.includes('evt_123') &&
        signature === 'valid-signature' &&
        secret === 'whsec_test'
      );
    },
    creemService: {
      async createCheckoutSession(input) {
        checkoutCalls += 1;

        if (checkoutShouldFail) {
          throw new Error('checkout create failed');
        }

        assert.deepEqual(input, {
          userId: 'user_1',
          email: 'user@example.com',
          apiKey: 'creem_api_key',
          productId: 'prod_123',
          appBaseUrl: 'https://paperboyfriend.shop',
          testMode: true,
          units: 1,
        });

        return {
          checkoutId: 'ch_123',
          checkoutUrl: 'https://checkout.creem.io/ch_123',
          requestId: 'req_123',
          status: 'pending',
          mode: 'test',
        };
      },
      async getBillingStatus(userId) {
        statusCalls += 1;
        assert.equal(userId, 'user_1');

        return {
          active: false,
          productId: 'prod_123',
          subscriptionStatus: null,
          checkoutStatus: 'pending',
          subscriptionId: null,
          customerId: null,
          currentPeriodEnd: null,
        };
      },
      async handleWebhook(input) {
        webhookCalls += 1;

        if (webhookShouldFail) {
          throw new Error('webhook processing failed');
        }

        assert.equal(input.signature, 'valid-signature');
        assert.equal(input.webhookSecret, 'whsec_test');
        assert.match(input.rawBody, /checkout\.completed/);
      },
    },
    logError() {},
  });

  const checkoutResponse = await handlers.checkout(
    new Request('http://localhost/api/creem/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ units: 1 }),
    }),
  );
  assert.equal(checkoutResponse.status, 201);
  assert.deepEqual(await checkoutResponse.json(), {
    checkoutId: 'ch_123',
    checkoutUrl: 'https://checkout.creem.io/ch_123',
    requestId: 'req_123',
    status: 'pending',
    mode: 'test',
  });

  const invalidCheckoutJsonResponse = await handlers.checkout(
    new Request('http://localhost/api/creem/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    }),
  );
  assert.equal(invalidCheckoutJsonResponse.status, 400);
  assert.deepEqual(await invalidCheckoutJsonResponse.json(), {
    error: 'Invalid JSON body',
  });

  const invalidUnitsResponse = await handlers.checkout(
    new Request('http://localhost/api/creem/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ units: 0 }),
    }),
  );
  assert.equal(invalidUnitsResponse.status, 400);
  assert.deepEqual(await invalidUnitsResponse.json(), {
    error: 'units must be a positive integer',
  });

  checkoutShouldFail = true;
  const failedCheckoutResponse = await handlers.checkout(
    new Request('http://localhost/api/creem/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(failedCheckoutResponse.status, 500);
  assert.deepEqual(await failedCheckoutResponse.json(), {
    error: 'Checkout service unavailable',
  });
  checkoutShouldFail = false;

  const billingStatusResponse = await handlers.status(
    new Request('http://localhost/api/billing/status', {
      method: 'GET',
    }),
  );
  assert.equal(billingStatusResponse.status, 200);
  assert.deepEqual(await billingStatusResponse.json(), {
    active: false,
    productId: 'prod_123',
    subscriptionStatus: null,
    checkoutStatus: 'pending',
    subscriptionId: null,
    customerId: null,
    currentPeriodEnd: null,
  });

  const invalidWebhookResponse = await handlers.webhook(
    new Request('http://localhost/api/creem/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'creem-signature': 'bad-signature',
      },
      body: JSON.stringify({
        id: 'evt_123',
        eventType: 'checkout.completed',
      }),
    }),
  );
  assert.equal(invalidWebhookResponse.status, 401);
  assert.deepEqual(await invalidWebhookResponse.json(), {
    error: 'Invalid webhook signature',
  });

  const validWebhookResponse = await handlers.webhook(
    new Request('http://localhost/api/creem/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'creem-signature': 'valid-signature',
      },
      body: JSON.stringify({
        id: 'evt_123',
        eventType: 'checkout.completed',
      }),
    }),
  );
  assert.equal(validWebhookResponse.status, 200);
  assert.deepEqual(await validWebhookResponse.json(), {
    received: true,
  });

  webhookShouldFail = true;
  const failedWebhookResponse = await handlers.webhook(
    new Request('http://localhost/api/creem/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'creem-signature': 'valid-signature',
      },
      body: JSON.stringify({
        id: 'evt_123',
        eventType: 'checkout.completed',
      }),
    }),
  );
  assert.equal(failedWebhookResponse.status, 500);
  assert.deepEqual(await failedWebhookResponse.json(), {
    error: 'Webhook processing failed',
  });

  assert.equal(checkoutCalls, 2);
  assert.equal(statusCalls, 1);
  assert.equal(webhookCalls, 2);

  console.log('creem route handlers test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
