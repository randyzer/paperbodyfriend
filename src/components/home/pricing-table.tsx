'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ANONYMOUS_MAX_ROUND_TRIPS,
  FREE_MAX_ROUND_TRIPS,
  MEMBER_PRICE_LABEL,
  type AccessTier,
} from '@/lib/paid-access';

type PricingTableProps = {
  currentTier: AccessTier;
};

const tierCards = [
  {
    key: 'anonymous',
    title: '游客试玩',
    subtitle: `${ANONYMOUS_MAX_ROUND_TRIPS} 轮体验`,
    points: ['无需登录即可开始', '达到上限后提示登录', '适合先体验角色风格'],
  },
  {
    key: 'free',
    title: '免费用户',
    subtitle: `${FREE_MAX_ROUND_TRIPS} 轮 / 每次游戏`,
    points: ['可保存账号资料', '达到上限后提示升级', '适合轻度体验'],
  },
  {
    key: 'paid',
    title: '会员订阅',
    subtitle: `${MEMBER_PRICE_LABEL} · 无限次`,
    points: ['无限制聊天轮次', '完整付费闭环已接入', '优先作为正式使用方案'],
  },
] as const;

export function PricingTable({ currentTier }: PricingTableProps) {
  return (
    <section className="rounded-3xl border border-pink-100 bg-white/90 p-6 shadow-lg">
      <div className="space-y-3 text-center">
        <p className="text-sm font-medium text-pink-500">Pricing</p>
        <h2 className="text-2xl font-semibold text-gray-900">选择适合你的对话方式</h2>
        <p className="text-sm text-gray-500">
          先试玩，再决定是否升级。会员版当前为 {MEMBER_PRICE_LABEL}，开通后无限次使用。
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {tierCards.map(card => {
          const isCurrent = currentTier === card.key;

          return (
            <Card
              key={card.key}
              className={
                card.key === 'paid'
                  ? 'border-pink-200 shadow-md'
                  : 'border-pink-100 shadow-sm'
              }
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl text-gray-900">{card.title}</CardTitle>
                  {isCurrent ? (
                    <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100">
                      当前身份
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-gray-700">{card.subtitle}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-gray-600">
                  {card.points.map(point => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-pink-400" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                {card.key === 'paid' ? (
                  <Button
                    asChild
                    className="w-full bg-pink-500 hover:bg-pink-600"
                    disabled={currentTier === 'paid'}
                  >
                    <Link href="/pricing">
                      {currentTier === 'paid' ? '当前已开通' : '立即开通会员'}
                    </Link>
                  </Button>
                ) : card.key === 'free' ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={currentTier === 'anonymous' ? '/register' : '/pricing'}>
                      {currentTier === 'anonymous' ? '登录后可继续' : '升级到会员'}
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="ghost" className="w-full">
                    <Link href={currentTier === 'anonymous' ? '#top' : '/chat'}>
                      {currentTier === 'anonymous' ? '继续试玩' : '返回聊天'}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
