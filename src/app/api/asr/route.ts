import { NextRequest, NextResponse } from 'next/server';
import { ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { audioBase64 } = await request.json();
    
    if (!audioBase64) {
      return NextResponse.json(
        { error: '缺少音频数据' },
        { status: 400 }
      );
    }

    // 提取headers
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 初始化ASR客户端
    const config = new Config();
    const client = new ASRClient(config, customHeaders);

    // 识别语音
    const result = await client.recognize({
      uid: 'ai_boyfriend_' + Date.now(),
      base64Data: audioBase64,
    });

    return NextResponse.json({
      text: result.text,
      duration: result.duration,
    });
  } catch (error) {
    console.error('ASR API error:', error);
    return NextResponse.json(
      { error: '语音识别失败，请稍后重试' },
      { status: 500 }
    );
  }
}
