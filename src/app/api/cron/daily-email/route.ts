import { NextRequest, NextResponse } from 'next/server';

import { sendDailyLoveLetterToAll } from '@/lib/email';
import { getServerEnv } from '@/server/env';

export const runtime = 'nodejs';

type DailyEmailCronRouteDeps = {
  sendDailyLoveLetterToAll(): Promise<void>;
  getCronSecret(): string | null;
  getCurrentTime(): string;
  logError(message: string, error: unknown): void;
};

export function createDailyEmailCronRoute(
  deps: DailyEmailCronRouteDeps,
) {
  return async function handleDailyEmailCron(request: Request) {
    const cronSecret = deps.getCronSecret();
    if (!cronSecret) {
      deps.logError('每日情话发送失败：', new Error('CRON_SECRET is missing'));
      return NextResponse.json(
        { error: '服务端配置缺失' },
        { status: 500 },
      );
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 },
      );
    }

    try {
      await deps.sendDailyLoveLetterToAll();
      return NextResponse.json({
        success: true,
        message: '每日情话发送完成',
        time: deps.getCurrentTime(),
      });
    } catch (error) {
      deps.logError('每日情话发送失败：', error);
      return NextResponse.json(
        { error: '发送失败' },
        { status: 500 },
      );
    }
  };
}

export async function GET(request: NextRequest) {
  return createDailyEmailCronRoute({
    sendDailyLoveLetterToAll,
    getCronSecret() {
      return getServerEnv().CRON_SECRET?.trim() || null;
    },
    getCurrentTime() {
      return new Date().toISOString();
    },
    logError(message, error) {
      console.error(message, error);
    },
  })(request);
}
