import { NextResponse } from 'next/server';

import { AuthError } from '@/server/auth/auth-service';
import { parseBase64AudioPayload } from '@/lib/ai/utils/media';

type TtsRouteDeps = {
  getCurrentUser(request: Request): Promise<{ id: string }>;
  synthesizeSpeech(input: {
    text: string;
    characterId?: string;
  }): Promise<{
    audioUrl: string;
    audioSize: number;
    contentType: string;
  }>;
  uploadAudio(input: {
    userId: string;
    buffer: Buffer;
    contentType: string;
    extension: string;
  }): Promise<string>;
};

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.userMessage, code: error.code },
      { status: error.statusCode },
    );
  }

  const message =
    error instanceof Error ? error.message : '语音合成失败，请稍后重试';

  return NextResponse.json({ error: message }, { status: 500 });
}

export function createTtsRouteHandler(deps: TtsRouteDeps) {
  return async function ttsRoute(request: Request) {
    try {
      const user = await deps.getCurrentUser(request);
      const body = await request.json().catch(() => null);
      const text =
        body && typeof body === 'object' && typeof body.text === 'string'
          ? body.text
          : '';
      const characterId =
        body && typeof body === 'object' && typeof body.characterId === 'string'
          ? body.characterId
          : undefined;

      if (!text) {
        return NextResponse.json({ error: '缺少文本内容' }, { status: 400 });
      }

      const response = await deps.synthesizeSpeech({
        text,
        characterId,
      });
      const parsedAudio = parseBase64AudioPayload(response.audioUrl);
      const permanentUrl = await deps.uploadAudio({
        userId: user.id,
        buffer: parsedAudio.bytes,
        contentType: parsedAudio.contentType,
        extension: parsedAudio.extension,
      });

      return NextResponse.json({
        audioUri: permanentUrl,
        audioSize: response.audioSize,
      });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
