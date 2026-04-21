import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { synthesizeCharacterSpeech } from '@/lib/ai/services/speech-service';
import { AuthError } from '@/server/auth/auth-service';
import { requireAuthenticatedUser } from '@/server/auth/request-auth';
import { createTtsRouteHandler } from '@/server/media/tts-route-handler';
import { uploadAssetToR2 } from '@/server/media/r2-media';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return createTtsRouteHandler({
    async getCurrentUser(innerRequest) {
      return requireAuthenticatedUser(innerRequest);
    },
    async synthesizeSpeech(input) {
      return synthesizeCharacterSpeech(input);
    },
    async uploadAudio(input) {
      return uploadAssetToR2({
        userId: input.userId,
        directory: 'audio',
        buffer: input.buffer,
        contentType: input.contentType,
        extension: input.extension,
      });
    },
  })(request).catch(error => {
    console.error('TTS API error:', error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode },
      );
    }
    const routeError = toRouteError(error, '语音合成失败，请稍后重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  });
}
