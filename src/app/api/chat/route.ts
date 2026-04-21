import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { detectMediaIntent } from '@/lib/ai/media-intent';
import { generateGameText } from '@/lib/ai/services/game-ai-service';
import { AuthError } from '@/server/auth/auth-service';
import { requireAuthenticatedUser } from '@/server/auth/request-auth';

export const runtime = 'nodejs';

// 心理健康关键词
const MENTAL_HEALTH_KEYWORDS = [
  '自杀', '想死', '不想活了', '活着没意思', 
  '抑郁症', '抑郁了', '很抑郁', '严重抑郁',
  '自残', '伤害自己', '想伤害自己',
  '活不下去了', '没有希望', '绝望'
];

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request);

    const { messages, characterPrompt, messageCount = 0 } = await request.json();
    
    if (!messages || !characterPrompt) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 检查是否有心理健康相关内容
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop();
    const hasMentalHealthKeywords = lastUserMessage && 
      MENTAL_HEALTH_KEYWORDS.some(keyword => lastUserMessage.content?.includes(keyword));

    // 检测用户是否想看媒体
    const mediaIntent = lastUserMessage ? detectMediaIntent(lastUserMessage.content || '') : null;
    if (mediaIntent && lastUserMessage?.content) {
      console.log(`[Media Intent] Detected ${mediaIntent} in "${lastUserMessage.content}"`);
    }

    // 构建系统提示
    let systemPrompt = characterPrompt;

    // 添加当前时间信息
    const now = new Date();
    const timeInfo = `
当前时间：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}
    `;
    systemPrompt += timeInfo;

    // 如果用户想看媒体，添加提示
    if (mediaIntent) {
      const mediaTypeText = mediaIntent === 'selfie' ? '照片/自拍' : mediaIntent === 'dance' ? '跳舞视频' : '运动/健身视频';
      systemPrompt += `

【重要】用户明确想看你的${mediaTypeText}。
请直接简短回复表示你会发给她看，比如：
- "好，给你拍一个"
- "等我一下"
- "马上给你发"
回复完后系统会自动发送${mediaTypeText}。`;
    }

    // 如果检测到心理健康问题，添加引导提示
    if (hasMentalHealthKeywords) {
      systemPrompt += `

【重要提醒】如果用户提到自杀、自残、严重抑郁等心理问题，请：
1. 表达关心和担忧
2. 温柔地建议她寻求专业帮助
3. 可以说"如果你感到很痛苦，建议找专业的心理咨询师聊聊，他们会更好地帮助你"
4. 不要试图解决严重的心理问题，这不是你能处理的
5. 语气要温暖但认真`;
    }

    // 添加回复风格指导
    systemPrompt += `

【回复规则 - 必须遵守】
1. 回复必须简短，1-2句话，最多不超过3句话
2. 像正常人聊天，不要太正式，不要长篇大论
3. 不要总是说安慰的话，可以聊聊日常、开玩笑
4. 可以适当用1-2个表情，但不要每句都有
5. 保持对话的自然流动，不要每次都问问题`;

    // 判断是否应该主动发送媒体（每15轮对话）
    let autoMedia: 'selfie' | 'dance' | 'workout' | null = null;
    if (!mediaIntent && messageCount > 0 && messageCount % 15 === 0) {
      const rand = Math.random();
      if (rand < 0.4) {
        autoMedia = 'selfie';
      } else if (rand < 0.7) {
        autoMedia = 'dance';
      } else {
        autoMedia = 'workout';
      }
    }

    const result = await generateGameText({
      capability:
        messages.length <= 1 && lastUserMessage?.content === '打招呼'
          ? 'game_start'
          : 'game_chat',
      messages: messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      systemPrompt,
    });

    const finalMedia = mediaIntent || autoMedia;
    const responseText = finalMedia
      ? `${result.text}[MEDIA:${finalMedia}]`
      : result.text;

    return new Response(responseText, {
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode },
      );
    }
    const routeError = toRouteError(error, '对话生成失败，请稍后重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  }
}
