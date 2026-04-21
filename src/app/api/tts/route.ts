import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { synthesizeCharacterSpeech } from '@/lib/ai/services/speech-service';
import { AuthError } from '@/server/auth/auth-service';
import { requireAuthenticatedUser } from '@/server/auth/request-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request);

    const { text, characterId } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: '缺少文本内容' },
        { status: 400 }
      );
    }

    const response = await synthesizeCharacterSpeech({
      text,
      characterId,
    });

    return NextResponse.json({
      audioUri: response.audioUrl,
      audioSize: response.audioSize,
    });
  } catch (error) {
    console.error('TTS API error:', error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode },
      );
    }
    const routeError = toRouteError(error, '语音合成失败，请稍后重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  }
}
