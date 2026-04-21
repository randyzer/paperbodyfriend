import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { DEFAULT_CHARACTER_VIDEO_OPTIONS } from '@/lib/video-presets';
import {
  getCharacterVideoStatus,
  submitCharacterVideo,
} from '@/lib/ai/services/media-service';
import { AuthError } from '@/server/auth/auth-service';
import { requireAuthenticatedUser } from '@/server/auth/request-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request);

    const {
      prompt,
      duration = DEFAULT_CHARACTER_VIDEO_OPTIONS.duration,
      ratio = DEFAULT_CHARACTER_VIDEO_OPTIONS.ratio,
      resolution = DEFAULT_CHARACTER_VIDEO_OPTIONS.resolution,
      firstFrameUrl,
      requestId,
    } = await request.json();

    if (requestId) {
      const response = await getCharacterVideoStatus({
        requestId,
      });

      return NextResponse.json({
        requestId: response.requestId,
        status: response.status,
        videoUrl: response.videoUrl,
        error: response.reason,
      });
    }

    if (!prompt) {
      return NextResponse.json(
        { error: '缺少提示词' },
        { status: 400 }
      );
    }

    const response = await submitCharacterVideo({
      prompt,
      duration,
      ratio: ratio as '16:9' | '9:16' | '1:1',
      resolution: resolution as '480p' | '720p' | '1080p',
      firstFrameUrl,
    });

    return NextResponse.json({
      requestId: response.requestId,
      status: response.status,
    });
  } catch (error) {
    console.error('Video API error:', error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode },
      );
    }
    const routeError = toRouteError(error, '视频生成失败，请稍后重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  }
}
