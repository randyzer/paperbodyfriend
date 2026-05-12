import { verifyCreemReturnSignatureFromSearchParams } from './signatures';

type ReturnState =
  | {
      kind: 'active' | 'pending';
      requestId: string;
      productId: string;
      checkoutId: string;
      subscriptionId: string | null;
    }
  | {
      kind: 'invalid';
    };

export async function resolveCreemReturnState(input: {
  searchParams: URLSearchParams;
  apiKey: string;
  findCheckoutByRequestId(requestId: string): Promise<{
    requestId: string;
    productId: string;
    checkoutStatus: string;
    subscriptionStatus: string | null;
  } | null>;
}): Promise<ReturnState> {
  const checkoutId = input.searchParams.get('checkout_id');
  const subscriptionId = input.searchParams.get('subscription_id');
  const productId = input.searchParams.get('product_id');
  const requestId = input.searchParams.get('request_id');

  if (!verifyCreemReturnSignatureFromSearchParams(input.searchParams, input.apiKey)) {
    return { kind: 'invalid' };
  }

  if (!requestId || !productId || !checkoutId) {
    return { kind: 'invalid' };
  }

  const checkout = await input.findCheckoutByRequestId(requestId);
  if (!checkout) {
    return {
      kind: 'pending',
      requestId,
      productId,
      checkoutId,
      subscriptionId,
    };
  }

  return {
    kind:
      checkout.subscriptionStatus === 'active' ||
      checkout.subscriptionStatus === 'paid' ||
      checkout.subscriptionStatus === 'trialing'
        ? 'active'
        : 'pending',
    requestId,
    productId: checkout.productId,
    checkoutId,
    subscriptionId,
  };
}
