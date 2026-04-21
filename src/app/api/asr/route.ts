import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { transcribeAudio } from '@/lib/ai/services/speech-service';
import { AuthError } from '@/server/auth/auth-service';
import { requireAuthenticatedUser } from '@/server/auth/request-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request);

    const { audioBase64 } = await request.json();
    
    if (!audioBase64) {
      return NextResponse.json(
        { error: '缺少音频数据' },
        { status: 400 }
      );
    }

    const result = await transcribeAudio({
      audioBase64,
    });

    return NextResponse.json({
      text: result.text,
      duration: result.duration,
    });
  } catch (error) {
    console.error('ASR API error:', error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode },
      );
    }
    const routeError = toRouteError(error, '语音识别失败，请稍后重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  }
}
