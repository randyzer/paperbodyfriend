import assert from 'node:assert/strict';
import crypto from 'node:crypto';

async function main() {
  const { resolveCreemReturnState } = await import(
    '../src/server/creem/return-url'
  );

  const apiKey = 'creem_test_api_key';
  const validParams = {
    checkout_id: 'ch_123',
    order_id: 'ord_123',
    customer_id: 'cust_123',
    subscription_id: 'sub_123',
    product_id: 'prod_123',
    request_id: 'req_123',
  };

  const sortedPayload =
    'checkout_id=ch_123&customer_id=cust_123&order_id=ord_123&product_id=prod_123&request_id=req_123&subscription_id=sub_123';
  const signature = crypto
    .createHmac('sha256', apiKey)
    .update(sortedPayload)
    .digest('hex');

  const activeState = await resolveCreemReturnState({
    searchParams: new URLSearchParams({
      ...validParams,
      signature,
    }),
    apiKey,
    async findCheckoutByRequestId(requestId) {
      assert.equal(requestId, 'req_123');
      return {
        requestId: 'req_123',
        productId: 'prod_123',
        checkoutStatus: 'completed',
        subscriptionStatus: 'active',
      };
    },
  });

  assert.deepEqual(activeState, {
    kind: 'active',
    requestId: 'req_123',
    productId: 'prod_123',
    checkoutId: 'ch_123',
    subscriptionId: 'sub_123',
  });

  const pendingState = await resolveCreemReturnState({
    searchParams: new URLSearchParams({
      ...validParams,
      signature,
    }),
    apiKey,
    async findCheckoutByRequestId() {
      return {
        requestId: 'req_123',
        productId: 'prod_123',
        checkoutStatus: 'pending',
        subscriptionStatus: null,
      };
    },
  });

  assert.deepEqual(pendingState, {
    kind: 'pending',
    requestId: 'req_123',
    productId: 'prod_123',
    checkoutId: 'ch_123',
    subscriptionId: 'sub_123',
  });

  const invalidState = await resolveCreemReturnState({
    searchParams: new URLSearchParams({
      ...validParams,
      signature: 'bad-signature',
    }),
    apiKey,
    async findCheckoutByRequestId() {
      throw new Error('should not be called');
    },
  });

  assert.deepEqual(invalidState, {
    kind: 'invalid',
  });

  const legacySignature = crypto
    .createHash('sha256')
    .update(
      [
        'request_id=req_123',
        'checkout_id=ch_123',
        'order_id=ord_123',
        'customer_id=cust_123',
        'subscription_id=sub_123',
        'product_id=prod_123',
        `salt=${apiKey}`,
      ].join('|'),
    )
    .digest('hex');

  const legacyState = await resolveCreemReturnState({
    searchParams: new URLSearchParams(
      `request_id=req_123&checkout_id=ch_123&order_id=ord_123&customer_id=cust_123&subscription_id=sub_123&product_id=prod_123&signature=${legacySignature}`,
    ),
    apiKey,
    async findCheckoutByRequestId(requestId) {
      assert.equal(requestId, 'req_123');
      return {
        requestId: 'req_123',
        productId: 'prod_123',
        checkoutStatus: 'completed',
        subscriptionStatus: 'active',
      };
    },
  });

  assert.deepEqual(legacyState, {
    kind: 'active',
    requestId: 'req_123',
    productId: 'prod_123',
    checkoutId: 'ch_123',
    subscriptionId: 'sub_123',
  });

  console.log('creem return state test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
