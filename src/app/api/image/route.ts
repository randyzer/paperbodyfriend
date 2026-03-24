import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { prompt, characterName = '男生' } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: '缺少提示词' },
        { status: 400 }
      );
    }

    // 提取headers
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 初始化图像生成客户端
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    // 生成图像
    const response = await client.generate({
      prompt,
      size: '2K',
      watermark: true,
    });

    const helper = client.getResponseHelper(response);

    if (!helper.success) {
      return NextResponse.json(
        { error: helper.errorMessages[0] || '图像生成失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrls: helper.imageUrls,
    });
  } catch (error) {
    console.error('Image API error:', error);
    return NextResponse.json(
      { error: '图像生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
