import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { generateCharacterImage } from '@/lib/ai/services/media-service';
import { AuthError } from '@/server/auth/auth-service';
import { requireAuthenticatedUser } from '@/server/auth/request-auth';
import { uploadToR2 } from '@/lib/r2';
import { createImageRouteHandler } from '@/server/media/image-route-handler';

export const runtime = 'nodejs';

async function downloadGeneratedImage(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('下载 AI 生成图片失败');
  }

  const contentType =
    response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
}

export async function POST(request: NextRequest) {
  return createImageRouteHandler({
    async getCurrentUser(innerRequest) {
      return requireAuthenticatedUser(innerRequest);
    },
    async generateImage(input) {
      return generateCharacterImage(input);
    },
    async downloadImage(url) {
      return downloadGeneratedImage(url);
    },
    async uploadImage(input) {
      const fileName = `images/${input.userId}/${Date.now()}-${crypto.randomUUID()}.${input.extension}`;
      return uploadToR2(input.buffer, fileName, input.contentType);
    },
  })(request).catch(error => {
    console.error('Image API error:', error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode },
      );
    }
    const routeError = toRouteError(error, '图像生成失败，请稍后重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  });
}
