import { NextResponse } from 'next/server';

import { AuthError } from '@/server/auth/auth-service';

type ImageRouteDeps = {
  getCurrentUser(request: Request): Promise<{ id: string }>;
  generateImage(input: {
    prompt: string;
    referenceImage?: string;
  }): Promise<{
    imageUrls: string[];
  }>;
  downloadImage(url: string): Promise<{
    buffer: Buffer;
    contentType: string;
  }>;
  uploadImage(input: {
    userId: string;
    buffer: Buffer;
    contentType: string;
    extension: string;
  }): Promise<string>;
};

function getExtensionFromContentType(contentType: string) {
  const normalized = contentType.toLowerCase().split(';')[0]?.trim() ?? '';

  switch (normalized) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/png':
    default:
      return 'png';
  }
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.userMessage, code: error.code },
      { status: error.statusCode },
    );
  }

  const message =
    error instanceof Error ? error.message : '图像生成失败，请稍后重试';

  return NextResponse.json({ error: message }, { status: 500 });
}

export function createImageRouteHandler(deps: ImageRouteDeps) {
  return async function imageRoute(request: Request) {
    try {
      const user = await deps.getCurrentUser(request);
      const body = await request.json().catch(() => null);
      const prompt =
        body && typeof body === 'object' && typeof body.prompt === 'string'
          ? body.prompt
          : '';
      const referenceImage =
        body && typeof body === 'object' && typeof body.referenceImage === 'string'
          ? body.referenceImage
          : undefined;

      if (!prompt) {
        return NextResponse.json({ error: '缺少提示词' }, { status: 400 });
      }

      const generated = await deps.generateImage({
        prompt,
        referenceImage,
      });

      const tempImageUrl = generated.imageUrls[0];
      if (!tempImageUrl) {
        throw new Error('图像生成结果缺少图片链接');
      }

      const downloaded = await deps.downloadImage(tempImageUrl);
      const extension = getExtensionFromContentType(downloaded.contentType);
      const permanentUrl = await deps.uploadImage({
        userId: user.id,
        buffer: downloaded.buffer,
        contentType: downloaded.contentType,
        extension,
      });

      return NextResponse.json({
        imageUrls: [permanentUrl],
      });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
