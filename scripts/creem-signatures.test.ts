import assert from 'node:assert/strict';
import crypto from 'node:crypto';

async function main() {
  const {
    verifyCreemReturnSignature,
    verifyCreemReturnSignatureFromSearchParams,
    verifyCreemWebhookSignature,
  } = await import(
    '../src/server/creem/signatures'
  );

  const apiKey = 'creem_test_api_key';
  const returnParams = {
    checkout_id: 'ch_123',
    order_id: 'ord_123',
    customer_id: 'cust_123',
    subscription_id: null,
    product_id: 'prod_123',
    request_id: 'req_123',
  };

  const redirectPayload =
    'checkout_id=ch_123&customer_id=cust_123&order_id=ord_123&product_id=prod_123&request_id=req_123';
  const validRedirectSignature = crypto
    .createHmac('sha256', apiKey)
    .update(redirectPayload)
    .digest('hex');

  const legacyRedirectSignature = crypto
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

  assert.equal(
    verifyCreemReturnSignature(
      {
        ...returnParams,
        signature: validRedirectSignature,
      },
      apiKey,
    ),
    true,
  );

  assert.equal(
    verifyCreemReturnSignature(
      {
        request_id: 'req_123',
        checkout_id: 'ch_123',
        order_id: 'ord_123',
        customer_id: 'cust_123',
        subscription_id: 'sub_123',
        product_id: 'prod_123',
        signature: legacyRedirectSignature,
      },
      apiKey,
    ),
    true,
  );

  assert.equal(
    verifyCreemReturnSignatureFromSearchParams(
      new URLSearchParams(
        'request_id=req_123&checkout_id=ch_123&order_id=ord_123&customer_id=cust_123&subscription_id=sub_123&product_id=prod_123&signature=' +
          legacyRedirectSignature,
      ),
      apiKey,
    ),
    true,
  );

  assert.equal(
    verifyCreemReturnSignature(
      {
        ...returnParams,
        signature: 'invalid-signature',
      },
      apiKey,
    ),
    false,
  );

  const webhookPayload = JSON.stringify({
    id: 'evt_123',
    eventType: 'checkout.completed',
  });
  const webhookSecret = 'whsec_test';
  const validWebhookSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(webhookPayload)
    .digest('hex');

  assert.equal(
    verifyCreemWebhookSignature(
      webhookPayload,
      validWebhookSignature,
      webhookSecret,
    ),
    true,
  );
  assert.equal(
    verifyCreemWebhookSignature(webhookPayload, 'bad-signature', webhookSecret),
    false,
  );

  console.log('creem signatures test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
