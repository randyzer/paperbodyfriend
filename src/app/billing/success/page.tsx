import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCreemService } from '@/server/creem/default-creem-service';
import { resolveCreemReturnState } from '@/server/creem/return-url';
import { getServerEnv } from '@/server/env';

type BillingSuccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function appendSearchParam(
  target: URLSearchParams,
  key: string,
  value: string | string[] | undefined,
) {
  if (typeof value === 'string' && value) {
    target.set(key, value);
    return;
  }

  if (Array.isArray(value) && value[0]) {
    target.set(key, value[0]);
  }
}

export default async function BillingSuccessPage({
  searchParams,
}: BillingSuccessPageProps) {
  const env = getServerEnv();
  const rawSearchParams = (await searchParams) ?? {};
  const urlSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(rawSearchParams)) {
    appendSearchParam(urlSearchParams, key, value);
  }

  const state =
    env.CREEM_API_KEY
      ? await resolveCreemReturnState({
          searchParams: urlSearchParams,
          apiKey: env.CREEM_API_KEY,
          async findCheckoutByRequestId(requestId) {
            return getCreemService().getCheckoutSummaryByRequestId(requestId);
          },
        })
      : { kind: 'invalid' as const };

  return (
    <div className="bg-gradient-to-b from-pink-50 to-purple-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Card className="border-pink-100 shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-gray-900">
              {state.kind === 'active'
                ? '支付成功，会员已开通'
                : state.kind === 'pending'
                  ? '支付已返回，正在确认订阅状态'
                  : '支付结果校验失败'}
            </CardTitle>
            <p className="text-sm text-gray-500">
              {state.kind === 'active'
                ? 'Webhook 已经同步了你的订阅状态，可以正常返回继续使用。'
                : state.kind === 'pending'
                  ? '回跳签名已通过，但站内订阅状态还在等待 webhook 同步。通常只需几秒钟。'
                  : '当前回跳参数未通过签名校验，请不要直接信任此页面结果。'}
            </p>
          </CardHeader>

          <CardContent className="space-y-4 text-sm text-gray-600">
            {state.kind !== 'invalid' ? (
              <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-4">
                <p>Request ID：{state.requestId}</p>
                <p className="mt-1">Product ID：{state.productId}</p>
                <p className="mt-1">Checkout ID：{state.checkoutId}</p>
                {state.subscriptionId ? (
                  <p className="mt-1">Subscription ID：{state.subscriptionId}</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="bg-pink-500 hover:bg-pink-600">
                <Link href={state.kind === 'active' ? '/' : '/pricing'}>
                  {state.kind === 'active' ? '返回首页' : '返回订阅页'}
                </Link>
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/contact">联系支持</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
