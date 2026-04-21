import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { generateCharacterImage } from '@/lib/ai/services/media-service';
import { AuthError } from '@/server/auth/auth-service';
import { requireAuthenticatedUser } from '@/server/auth/request-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request);

    const { prompt, referenceImage } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: '缺少提示词' },
        { status: 400 }
      );
    }

    const response = await generateCharacterImage({
      prompt,
      referenceImage,
    });

    return NextResponse.json({
      imageUrls: response.imageUrls,
    });


  } catch (error) {
    console.error('Image API error:', error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode },
      );
    }
    const routeError = toRouteError(error, '图像生成失败，请稍后重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  }
}
