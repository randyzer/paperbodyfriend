import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { messages, characterPrompt, userInfo } = await request.json();
    
    if (!messages || !characterPrompt) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 构建系统提示
    let systemPrompt = characterPrompt;
    
    // 添加用户背景信息
    if (userInfo) {
      const userContext = `
用户基本信息：
- 年龄：${userInfo.age || '未知'}
- 城市：${userInfo.city || '未知'}
- 工作：${userInfo.job || '未知'}
- 性格：${userInfo.personality || '未知'}
- 吃饭口味：${userInfo.foodPreference || '未知'}
- 运动类型：${userInfo.sports || '未知'}
- 兴趣爱好：${userInfo.hobbies || '未知'}
- 睡眠时间：${userInfo.sleepTime || '未知'}

根据这些信息，用最合适的方式与她交流，关心她的生活，展现出对她的了解和在意。
      `;
      systemPrompt += userContext;
    }

    // 添加当前时间信息
    const now = new Date();
    const timeInfo = `
当前时间：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}
    `;
    systemPrompt += timeInfo;

    // 构建消息数组
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    ];

    // 提取headers
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 初始化LLM客户端
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 流式生成回复
    const stream = client.stream(chatMessages, {
      temperature: 0.8,
    });

    // 返回流式响应
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.content) {
              controller.enqueue(encoder.encode(chunk.content.toString()));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: '对话生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
