import { NextRequest, NextResponse } from 'next/server';
import { VideoGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { prompt, duration = 5, ratio = '16:9', resolution = '720p' } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: '缺少提示词' },
        { status: 400 }
      );
    }

    // 提取headers
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 初始化视频生成客户端
    const config = new Config();
    const client = new VideoGenerationClient(config, customHeaders);

    // 生成视频
    const response = await client.videoGeneration(
      [{ type: 'text' as const, text: prompt }],
      {
        model: 'doubao-seedance-1-5-pro-251215',
        duration,
        ratio: ratio as '16:9' | '9:16' | '1:1',
        resolution: resolution as '480p' | '720p' | '1080p',
        generateAudio: true,
      }
    );

    if (!response.videoUrl) {
      return NextResponse.json(
        { error: response.response.error_message || '视频生成失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      videoUrl: response.videoUrl,
      duration: response.response.duration,
      ratio: response.response.ratio,
      resolution: response.response.resolution,
    });
  } catch (error) {
    console.error('Video API error:', error);
    return NextResponse.json(
      { error: '视频生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
