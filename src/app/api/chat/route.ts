import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { detectMediaIntent } from '@/lib/ai/media-intent';
import { generateGameText } from '@/lib/ai/services/game-ai-service';
import { AuthError } from '@/server/auth/auth-service';
import { buildAnonChatRoundsCookie, readAnonChatRoundsCookie } from '@/server/access/anon-chat-cookie';
import { ChatAccessError } from '@/server/access/chat-access-errors';
import { createChatAccessService } from '@/server/access/chat-access-service';
import { getOptionalAuthenticatedUser } from '@/server/auth/request-auth';

export const runtime = 'nodejs';

// 心理健康关键词
const MENTAL_HEALTH_KEYWORDS = [
  '自杀', '想死', '不想活了', '活着没意思', 
  '抑郁症', '抑郁了', '很抑郁', '严重抑郁',
  '自残', '伤害自己', '想伤害自己',
  '活不下去了', '没有希望', '绝望'
];

type RouteMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const testGlobals = globalThis as typeof globalThis & {
  __paperBoyfriendTestGenerateGameText?: (input: {
    capability: 'game_start' | 'game_chat';
    messages: RouteMessage[];
    systemPrompt: string;
  }) => Promise<{ text: string }>;
};

async function createRouteChatAccessService() {
  return createChatAccessService({
    async getBillingStatus(userId) {
      if (
        process.env.AUTH_TEST_BYPASS === 'true' &&
        userId === 'test-user'
      ) {
        return { active: false };
      }

      const { getCreemService } = await import('@/server/creem/default-creem-service');
      return getCreemService().getBillingStatus(userId);
    },
  });
}

function getLastUserMessage(messages: RouteMessage[]) {
  return messages.filter(message => message.role === 'user').pop() ?? null;
}

function shouldCountRoundTrip(messages: RouteMessage[], lastUserMessage: RouteMessage | null) {
  if (!lastUserMessage) {
    return false;
  }

  return !(
    messages.length <= 1 &&
    lastUserMessage.content === '打招呼'
  );
}

async function generateRouteGameText(input: {
  capability: 'game_start' | 'game_chat';
  messages: RouteMessage[];
  systemPrompt: string;
}) {
  if (
    process.env.AUTH_TEST_BYPASS === 'true' &&
    testGlobals.__paperBoyfriendTestGenerateGameText
  ) {
    return testGlobals.__paperBoyfriendTestGenerateGameText(input);
  }

  return generateGameText(input);
}

export async function POST(request: NextRequest) {
  let reservedConversationRoundTrip:
    | {
        userId: string;
        conversationId: string;
      }
    | null = null;

  try {
    const {
      messages,
      characterPrompt,
      messageCount = 0,
      conversationId,
    } = await request.json();

    if (!Array.isArray(messages) || !characterPrompt) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    if (
      typeof conversationId !== 'string' ||
      conversationId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 },
      );
    }

    const normalizedConversationId = conversationId.trim();

    const user = await getOptionalAuthenticatedUser(request);
    const routeMessages = messages as RouteMessage[];
    const lastUserMessage = getLastUserMessage(routeMessages);
    const countedRoundTrip = shouldCountRoundTrip(routeMessages, lastUserMessage);

    const chatAccessService = await createRouteChatAccessService();
    const anonCookieState = !user
      ? readAnonChatRoundsCookie(
          request.headers.get('cookie'),
          normalizedConversationId,
        )
      : null;

    if (anonCookieState?.isTampered) {
      throw new ChatAccessError('ANON_CHAT_COOKIE_INVALID');
    }

    if (countedRoundTrip) {
      if (!user) {
        await chatAccessService.assertChatAllowed({
          userId: null,
          currentRoundTripCount: anonCookieState?.roundCount ?? 0,
        });
      } else {
        const access = await chatAccessService.resolveChatAccess({
          userId: user.id,
        });
        if (access.tier === 'free') {
          const { getConversationService } = await import(
            '@/server/conversations/default-conversation-service'
          );
          const reservation = await getConversationService().reserveConversationRoundTrip({
            userId: user.id,
            conversationId: normalizedConversationId,
            maxRoundTrips: access.maxRoundTrips,
          });

          if (reservation.status === 'not_found') {
            throw new Error('Conversation not found');
          }

          if (reservation.status === 'limit_reached') {
            throw new ChatAccessError('FREE_CHAT_LIMIT_REACHED');
          }

          reservedConversationRoundTrip = {
            userId: user.id,
            conversationId: normalizedConversationId,
          };
        }
      }
    }

    // 检查是否有心理健康相关内容
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

    const result = await generateRouteGameText({
      capability:
        routeMessages.length <= 1 && lastUserMessage?.content === '打招呼'
          ? 'game_start'
          : 'game_chat',
      messages: routeMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      systemPrompt,
    });

    const finalMedia = mediaIntent || autoMedia;
    const responseText = finalMedia
      ? `${result.text}[MEDIA:${finalMedia}]`
      : result.text;

    const headers = new Headers({
      'Content-Type': 'text/plain;charset=utf-8',
    });

    if (!user && countedRoundTrip) {
      headers.set(
        'Set-Cookie',
        buildAnonChatRoundsCookie(
          (anonCookieState?.roundCount ?? 0) + 1,
          normalizedConversationId,
        ),
      );
    }

    reservedConversationRoundTrip = null;

    return new Response(responseText, {
      headers,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    if (reservedConversationRoundTrip) {
      try {
        const { getConversationService } = await import(
          '@/server/conversations/default-conversation-service'
        );
        await getConversationService().releaseConversationRoundTrip(
          reservedConversationRoundTrip,
        );
      } catch (rollbackError) {
        console.error('Chat round-trip rollback error:', rollbackError);
      }
    }

    if (error instanceof ChatAccessError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode },
      );
    }
    if (error instanceof Error && error.message === 'Conversation not found') {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }
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
