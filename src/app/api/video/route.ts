import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { DEFAULT_CHARACTER_VIDEO_OPTIONS } from '@/lib/video-presets';
import {
  getCharacterVideoStatus,
  submitCharacterVideo,
} from '@/lib/ai/services/media-service';
import { AuthError } from '@/server/auth/auth-service';
import { requireAuthenticatedUser } from '@/server/auth/request-auth';
import { createVideoRouteHandler } from '@/server/media/video-route-handler';
import { downloadRemoteAsset, uploadAssetToR2 } from '@/server/media/r2-media';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return createVideoRouteHandler({
    async getCurrentUser(innerRequest) {
      return requireAuthenticatedUser(innerRequest);
    },
    async submitVideo(input) {
      return submitCharacterVideo({
        prompt: input.prompt,
        duration: input.duration ?? DEFAULT_CHARACTER_VIDEO_OPTIONS.duration,
        ratio: input.ratio ?? DEFAULT_CHARACTER_VIDEO_OPTIONS.ratio,
        resolution: input.resolution ?? DEFAULT_CHARACTER_VIDEO_OPTIONS.resolution,
        firstFrameUrl: input.firstFrameUrl,
      });
    },
    async getVideoStatus(input) {
      return getCharacterVideoStatus(input);
    },
    async downloadVideo(url) {
      const downloaded = await downloadRemoteAsset(url, 'video/mp4');
      return {
        buffer: downloaded.buffer,
        contentType: downloaded.contentType,
      };
    },
    async uploadVideo(input) {
      return uploadAssetToR2({
        userId: input.userId,
        directory: 'videos',
        buffer: input.buffer,
        contentType: input.contentType,
        extension: input.extension,
      });
    },
  })(request).catch(error => {
    console.error('Video API error:', error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode },
      );
    }
    const routeError = toRouteError(error, '视频生成失败，请稍后重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  });
}
