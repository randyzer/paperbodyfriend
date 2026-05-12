'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthSession } from '@/hooks/use-auth-session';

type BillingStatus = {
  active: boolean;
  productId: string | null;
  subscriptionStatus: string | null;
  checkoutStatus: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  currentPeriodEnd: string | null;
};

function getStatusLabel(status: BillingStatus | null) {
  if (!status) {
    return '加载中';
  }

  if (status.active) {
    return '已开通';
  }

  if (status.checkoutStatus === 'pending') {
    return '待完成支付';
  }

  return '未开通';
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export default function PricingPage() {
  const { isLoading: isSessionLoading, user } = useAuthSession({
    required: true,
  });
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadBillingStatus() {
      if (!user) {
        return;
      }

      try {
        setIsLoadingStatus(true);
        setError(null);

        const response = await fetch('/api/billing/status', {
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => null)) as
          | BillingStatus
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            payload && 'error' in payload && typeof payload.error === 'string'
              ? payload.error
              : '订阅状态加载失败，请稍后重试。',
          );
        }

        if (active) {
          setStatus(payload as BillingStatus);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : '订阅状态加载失败，请稍后重试。',
          );
        }
      } finally {
        if (active) {
          setIsLoadingStatus(false);
        }
      }
    }

    void loadBillingStatus();

    return () => {
      active = false;
    };
  }, [user]);

  async function handleCheckout() {
    try {
      setIsCreatingCheckout(true);
      setError(null);

      const response = await fetch('/api/creem/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          units: 1,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string; error?: string }
        | null;

      if (!response.ok || !payload?.checkoutUrl) {
        throw new Error(payload?.error ?? '创建支付会话失败，请稍后重试。');
      }

      window.location.assign(payload.checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : '创建支付会话失败，请稍后重试。',
      );
      setIsCreatingCheckout(false);
    }
  }

  const currentPeriodEndLabel = useMemo(
    () => formatDateLabel(status?.currentPeriodEnd ?? null),
    [status?.currentPeriodEnd],
  );

  if (isSessionLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-pink-50 px-4 py-12">
        <p className="text-sm text-gray-500">正在检查登录状态...</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-pink-50 to-purple-50 px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-pink-500">Creem Checkout</p>
          <h1 className="text-3xl font-semibold text-gray-900">开通会员订阅</h1>
          <p className="text-sm text-gray-500">
            使用 Creem 测试模式完成支付闭环，真正生效以 webhook 同步结果为准。
          </p>
        </div>

        <Card className="border-pink-100 shadow-lg">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-2xl text-gray-900">Paper Boyfriend 会员</CardTitle>
              <Badge
                className={
                  status?.active
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-pink-100 text-pink-700 hover:bg-pink-100'
                }
              >
                {getStatusLabel(status)}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              当前版本先按单一产品接入，后续再扩展套餐和客户中心。
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-4 text-sm text-gray-600">
              <p>你将获得：</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>完整 Creem Checkout 支付链路</li>
                <li>站内订阅状态查询</li>
                <li>支付成功页签名校验</li>
                <li>Webhook 同步订阅状态</li>
              </ul>
            </div>

            {currentPeriodEndLabel ? (
              <p className="text-sm text-gray-500">
                当前有效期至：{currentPeriodEndLabel}
              </p>
            ) : null}

            {error ? (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="bg-pink-500 hover:bg-pink-600"
                disabled={
                  isLoadingStatus || isCreatingCheckout || Boolean(status?.active)
                }
                onClick={() => {
                  void handleCheckout();
                }}
              >
                {isCreatingCheckout
                  ? '正在跳转支付...'
                  : status?.active
                    ? '当前已开通'
                    : '立即开通'}
              </Button>

              <Button asChild type="button" variant="outline">
                <Link href="/">返回首页</Link>
              </Button>
            </div>

            <p className="text-xs text-gray-400">
              {isLoadingStatus
                ? '正在同步你的订阅状态...'
                : '支付完成后会回跳到成功页，实际授权以后端 webhook 为准。'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
