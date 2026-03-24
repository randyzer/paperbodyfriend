import { NextRequest, NextResponse } from 'next/server';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { text, speaker = 'zh_female_xiaohe_uranus_bigtts' } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: '缺少文本内容' },
        { status: 400 }
      );
    }

    // 提取headers
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 初始化TTS客户端
    const config = new Config();
    const client = new TTSClient(config, customHeaders);

    // 生成语音
    const response = await client.synthesize({
      uid: 'ai_boyfriend_' + Date.now(),
      text,
      speaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
    });

    return NextResponse.json({
      audioUri: response.audioUri,
      audioSize: response.audioSize,
    });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: '语音合成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
