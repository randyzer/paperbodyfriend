import assert from 'node:assert/strict';

const testGlobals = globalThis as typeof globalThis & {
  __paperBoyfriendTestConversationService?: {
    reserveConversationRoundTrip(input: {
      userId: string;
      conversationId: string;
      maxRoundTrips: number;
    }): Promise<
      | { status: 'reserved'; roundTripCount: number }
      | { status: 'limit_reached' }
      | { status: 'not_found' }
    >;
    releaseConversationRoundTrip(input: {
      userId: string;
      conversationId: string;
    }): Promise<void>;
  };
  __paperBoyfriendTestGenerateGameText?: (input: {
    capability: 'game_start' | 'game_chat';
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    systemPrompt: string;
  }) => Promise<{ text: string }>;
};

const envKeys = [
  'ARK_API_KEY',
  'SILICONFLOW_API_KEY',
  'AUTH_TEST_BYPASS',
  'CHAT_ACCESS_COOKIE_SECRET',
] as const;

async function main() {
  const previousEnv = new Map<string, string | undefined>();

  for (const key of envKeys) {
    previousEnv.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    process.env.AUTH_TEST_BYPASS = 'true';
    process.env.CHAT_ACCESS_COOKIE_SECRET = 'chat-access-test-secret';
    const { POST } = await import('../src/app/api/chat/route');
    const {
      buildAnonChatRoundsCookie,
      readAnonChatRoundsCookie,
    } = await import('../src/server/access/anon-chat-cookie');

    {
      const tamperedCookie = buildAnonChatRoundsCookie(3, 'anon_conversation_tampered').replace(
        'paper_boyfriend_anon_rounds=v1.3.',
        'paper_boyfriend_anon_rounds=v1.0.',
      );
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: tamperedCookie,
        },
        body: JSON.stringify({
          conversationId: 'anon_conversation_tampered',
          messages: [{ role: 'user', content: '继续聊' }],
          characterPrompt: '你是一个温柔的男朋友',
        }),
      });

      const response = await POST(request as never);
      const data = await response.json();

      assert.equal(response.status, 403, 'tampered anonymous cookie should be blocked');
      assert.equal(data.code, 'ANON_CHAT_COOKIE_INVALID');
    }

    {
      testGlobals.__paperBoyfriendTestGenerateGameText = async () => ({
        text: '匿名新局继续聊',
      });

      const exhaustedCookie = buildAnonChatRoundsCookie(3, 'anon_conversation_old');
      const sameConversationRequest = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: exhaustedCookie,
        },
        body: JSON.stringify({
          conversationId: 'anon_conversation_old',
          messages: [{ role: 'user', content: '这局应该被限制' }],
          characterPrompt: '你是一个温柔的男朋友',
        }),
      });

      const sameConversationResponse = await POST(sameConversationRequest as never);
      const sameConversationBody = await sameConversationResponse.json();

      assert.equal(
        sameConversationResponse.status,
        403,
        'same anonymous conversation should keep the existing round count',
      );
      assert.equal(sameConversationBody.code, 'ANON_CHAT_LIMIT_REACHED');

      const newConversationRequest = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: exhaustedCookie,
        },
        body: JSON.stringify({
          conversationId: 'anon_conversation_new',
          messages: [{ role: 'user', content: '新开一局要从 0 开始' }],
          characterPrompt: '你是一个温柔的男朋友',
        }),
      });

      const newConversationResponse = await POST(newConversationRequest as never);
      const newConversationBody = await newConversationResponse.text();
      const nextCookie = newConversationResponse.headers.get('set-cookie');

      assert.equal(
        newConversationResponse.status,
        200,
        'new anonymous conversation should not inherit the old game round count',
      );
      assert.equal(newConversationBody, '匿名新局继续聊');
      assert.ok(nextCookie, 'successful anonymous chat should refresh the signed cookie');
      assert.deepEqual(
        readAnonChatRoundsCookie(nextCookie, 'anon_conversation_new'),
        {
          exists: true,
          isTampered: false,
          roundCount: 1,
        },
      );
    }

    {
      const attemptedConversationIds: string[] = [];
      let currentRoundTripCount = 6;
      const createFreeTierRequest = () =>
        new Request('http://localhost/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: 'paperboyfriend_session=test-session-token',
          },
          body: JSON.stringify({
            conversationId: 'conversation_success',
            messages: [{ role: 'user', content: '正常聊天' }],
            characterPrompt: '你是一个温柔的男朋友',
          }),
        });

      testGlobals.__paperBoyfriendTestConversationService = {
        async reserveConversationRoundTrip(input) {
          attemptedConversationIds.push(input.conversationId);
          if (currentRoundTripCount >= input.maxRoundTrips) {
            return { status: 'limit_reached' };
          }

          currentRoundTripCount += 1;
          return {
            status: 'reserved',
            roundTripCount: currentRoundTripCount,
          };
        },
        async releaseConversationRoundTrip() {
          currentRoundTripCount = Math.max(0, currentRoundTripCount - 1);
        },
      };
      testGlobals.__paperBoyfriendTestGenerateGameText = async () => ({
        text: '测试回复',
      });

      const firstResponse = await POST(createFreeTierRequest() as never);
      const firstBody = await firstResponse.text();

      assert.equal(firstResponse.status, 200, 'free-tier request should succeed before the seventh round is consumed');
      assert.equal(firstBody, '测试回复');
      assert.equal(currentRoundTripCount, 7, 'successful /api/chat response should consume the round trip immediately');

      const secondResponse = await POST(createFreeTierRequest() as never);
      const secondBody = await secondResponse.json();

      assert.equal(secondResponse.status, 403, 'free-tier limit should be enforced by /api/chat without waiting for sync');
      assert.equal(secondBody.code, 'FREE_CHAT_LIMIT_REACHED');
      assert.deepEqual(attemptedConversationIds, [
        'conversation_success',
        'conversation_success',
      ]);
    }

    {
      const reservationEvents: string[] = [];
      let currentRoundTripCount = 0;

      testGlobals.__paperBoyfriendTestConversationService = {
        async reserveConversationRoundTrip(input) {
          reservationEvents.push(`reserve:${input.conversationId}`);
          currentRoundTripCount += 1;
          return {
            status: 'reserved',
            roundTripCount: currentRoundTripCount,
          };
        },
        async releaseConversationRoundTrip(input) {
          reservationEvents.push(`release:${input.conversationId}`);
          currentRoundTripCount = Math.max(0, currentRoundTripCount - 1);
        },
      };
      delete testGlobals.__paperBoyfriendTestGenerateGameText;

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: 'paperboyfriend_session=test-session-token',
        },
        body: JSON.stringify({
          conversationId: 'conversation_rollback',
          messages: [{ role: 'user', content: '这一轮应该在失败后回滚' }],
          characterPrompt: '你是一个温柔的男朋友',
        }),
      });

      const response = await POST(request as never);
      const data = await response.json();

      assert.equal(response.status, 401, 'missing AI config should surface a 401 business error');
      assert.equal(data.code, 'UNAUTHORIZED');
      assert.match(data.error, /鉴权失败|密钥配置/);
      assert.equal(currentRoundTripCount, 0, 'failed AI generation should roll back the reserved round trip');
      assert.deepEqual(reservationEvents, [
        'reserve:conversation_rollback',
        'release:conversation_rollback',
      ]);
    }

    {
      let reserveCalled = false;

      testGlobals.__paperBoyfriendTestConversationService = {
        async reserveConversationRoundTrip() {
          reserveCalled = true;
          return {
            status: 'reserved',
            roundTripCount: 1,
          };
        },
        async releaseConversationRoundTrip() {},
      };
      testGlobals.__paperBoyfriendTestGenerateGameText = async () => ({
        text: '欢迎回来呀',
      });

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: 'paperboyfriend_session=test-session-token',
        },
        body: JSON.stringify({
          conversationId: 'conversation_greeting',
          messages: [{ role: 'user', content: '打招呼' }],
          characterPrompt: '你是一个温柔的男朋友',
        }),
      });

      const response = await POST(request as never);
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.equal(body, '欢迎回来呀');
      assert.equal(
        reserveCalled,
        false,
        'initial greeting should not reserve a counted round trip',
      );
    }

    console.log('chat route access tests passed.');
  } finally {
    delete testGlobals.__paperBoyfriendTestConversationService;
    delete testGlobals.__paperBoyfriendTestGenerateGameText;

    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
