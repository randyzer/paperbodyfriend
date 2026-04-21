import { NextResponse } from 'next/server';

import { AuthError } from '@/server/auth/auth-service';

type VideoRouteDeps = {
  getCurrentUser(request: Request): Promise<{ id: string }>;
  submitVideo(input: {
    prompt: string;
    duration?: number;
    ratio?: '16:9' | '9:16' | '1:1';
    resolution?: '480p' | '720p' | '1080p';
    firstFrameUrl?: string;
  }): Promise<{
    requestId: string;
    status: 'queued';
  }>;
  getVideoStatus(input: {
    requestId: string;
  }): Promise<{
    requestId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    videoUrl?: string;
    reason?: string;
  }>;
  downloadVideo(url: string): Promise<{
    buffer: Buffer;
    contentType: string;
  }>;
  uploadVideo(input: {
    userId: string;
    buffer: Buffer;
    contentType: string;
    extension: string;
  }): Promise<string>;
};

function getExtensionFromContentType(contentType: string) {
  const normalized = contentType.toLowerCase().split(';')[0]?.trim() ?? '';

  switch (normalized) {
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    case 'video/mp4':
    default:
      return 'mp4';
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
    error instanceof Error ? error.message : '视频生成失败，请稍后重试';

  return NextResponse.json({ error: message }, { status: 500 });
}

export function createVideoRouteHandler(deps: VideoRouteDeps) {
  return async function videoRoute(request: Request) {
    try {
      const user = await deps.getCurrentUser(request);
      const body = await request.json().catch(() => null);
      const prompt =
        body && typeof body === 'object' && typeof body.prompt === 'string'
          ? body.prompt
          : '';
      const duration =
        body && typeof body === 'object' && typeof body.duration === 'number'
          ? body.duration
          : undefined;
      const ratio =
        body && typeof body === 'object' && typeof body.ratio === 'string'
          ? (body.ratio as '16:9' | '9:16' | '1:1')
          : undefined;
      const resolution =
        body && typeof body === 'object' && typeof body.resolution === 'string'
          ? (body.resolution as '480p' | '720p' | '1080p')
          : undefined;
      const firstFrameUrl =
        body && typeof body === 'object' && typeof body.firstFrameUrl === 'string'
          ? body.firstFrameUrl
          : undefined;
      const requestId =
        body && typeof body === 'object' && typeof body.requestId === 'string'
          ? body.requestId
          : '';

      if (requestId) {
        const response = await deps.getVideoStatus({ requestId });

        if (response.status === 'completed' && response.videoUrl) {
          const downloaded = await deps.downloadVideo(response.videoUrl);
          const permanentUrl = await deps.uploadVideo({
            userId: user.id,
            buffer: downloaded.buffer,
            contentType: downloaded.contentType,
            extension: getExtensionFromContentType(downloaded.contentType),
          });

          return NextResponse.json({
            requestId: response.requestId,
            status: response.status,
            videoUrl: permanentUrl,
            error: undefined,
          });
        }

        return NextResponse.json({
          requestId: response.requestId,
          status: response.status,
          videoUrl: response.videoUrl,
          error: response.reason,
        });
      }

      if (!prompt) {
        return NextResponse.json({ error: '缺少提示词' }, { status: 400 });
      }

      const response = await deps.submitVideo({
        prompt,
        duration,
        ratio,
        resolution,
        firstFrameUrl,
      });

      return NextResponse.json({
        requestId: response.requestId,
        status: response.status,
      });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
