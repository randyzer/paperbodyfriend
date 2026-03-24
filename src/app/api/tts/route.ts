import { NextRequest, NextResponse } from 'next/server';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

// 角色对应的语音
const CHARACTER_VOICES: Record<string, string> = {
  uncle: 'zh_male_dayi_saturn_bigtts',      // 大叔 - Dayi (成熟男性)
  sunshine: 'zh_male_m191_uranus_bigtts',   // 阳光男孩 - 云舟
  straight_man: 'zh_male_taocheng_uranus_bigtts', // 直男 - 小天
};

export async function POST(request: NextRequest) {
  try {
    const { text, characterId } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: '缺少文本内容' },
        { status: 400 }
      );
    }

    // 根据角色选择语音
    const speaker = characterId ? CHARACTER_VOICES[characterId] || 'zh_male_m191_uranus_bigtts' : 'zh_male_m191_uranus_bigtts';

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
