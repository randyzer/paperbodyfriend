'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ChatLimitCardProps = {
  mode: 'login' | 'upgrade';
};

export function ChatLimitCard({ mode }: ChatLimitCardProps) {
  const title =
    mode === 'login' ? '试玩轮次已用完' : '免费轮次已用完';
  const description =
    mode === 'login'
      ? '继续聊下去前，先登录一个账号吧。登录后每次游戏可继续体验 7 轮。'
      : '你当前是免费用户。升级会员后即可无限次使用，不再受 7 轮限制。';

  return (
    <Card className="border-pink-200 bg-white/95 shadow-lg">
      <CardHeader className="space-y-2">
        <p className="text-sm font-medium text-pink-500">
          {mode === 'login' ? '登录后继续' : '升级会员'}
        </p>
        <CardTitle className="text-xl text-gray-900">{title}</CardTitle>
        <p className="text-sm text-gray-600">{description}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Button
          asChild
          className="bg-pink-500 hover:bg-pink-600"
        >
          <Link href={mode === 'login' ? '/login' : '/pricing'}>
            {mode === 'login' ? '去登录' : '去开通会员'}
          </Link>
        </Button>

        {mode === 'login' ? (
          <Button asChild type="button" variant="outline">
            <Link href="/register">注册账号</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
