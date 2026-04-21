import assert from 'node:assert/strict';

async function main() {
  const { createConversationRouteHandlers } = await import(
    '../src/server/conversations/route-handlers'
  );

  let conversationDetailResult: unknown = {
    conversation: {
      id: 'conversation_1',
      characterId: 'uncle',
    },
    messages: [],
  };
  let syncConversationError: Error | null = null;

  const handlers = createConversationRouteHandlers({
    async getCurrentUser() {
      return {
        id: 'user_1',
      };
    },
    conversationService: {
      async getResumeCandidate(userId: string) {
        assert.equal(userId, 'user_1');
        return {
          conversationId: 'conversation_1',
          characterId: 'uncle',
          lastMessagePreview: '上次聊到这里',
          lastMessageAt: new Date('2026-04-20T10:00:00.000Z'),
        };
      },
      async createConversation(input: { userId: string; characterId: string }) {
        assert.deepEqual(input, {
          userId: 'user_1',
          characterId: 'uncle',
        });

        return {
          id: 'conversation_1',
          characterId: input.characterId,
        };
      },
      async getConversationDetail(input: { userId: string; conversationId: string }) {
        assert.deepEqual(input, {
          userId: 'user_1',
          conversationId: 'conversation_1',
        });

        return conversationDetailResult;
      },
      async syncConversationMessages(input: {
        userId: string;
        conversationId: string;
        characterId: string;
        messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }>;
      }) {
        if (syncConversationError) {
          throw syncConversationError;
        }

        assert.deepEqual(input, {
          userId: 'user_1',
          conversationId: 'conversation_1',
          characterId: 'uncle',
          messages: [
            {
              id: 'message_1',
              role: 'user',
              content: '你好',
              timestamp: 1713600000000,
            },
          ],
        });

        return {
          conversationId: input.conversationId,
          persistedCount: input.messages.length,
        };
      },
    },
  });

  const resumeCandidateResponse = await handlers.resumeCandidate();
  assert.equal(resumeCandidateResponse.status, 200);
  assert.deepEqual(await resumeCandidateResponse.json(), {
    hasResumeCandidate: true,
    source: 'database',
    conversationId: 'conversation_1',
    characterId: 'uncle',
    lastMessagePreview: '上次聊到这里',
    lastMessageAt: '2026-04-20T10:00:00.000Z',
  });

  const createConversationResponse = await handlers.createConversation(
    new Request('http://localhost/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: 'uncle' }),
    }),
  );
  assert.equal(createConversationResponse.status, 201);
  assert.deepEqual(await createConversationResponse.json(), {
    conversationId: 'conversation_1',
    characterId: 'uncle',
  });

  const invalidCreateConversationJsonResponse = await handlers.createConversation(
    new Request('http://localhost/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    }),
  );
  assert.equal(invalidCreateConversationJsonResponse.status, 400);
  assert.deepEqual(await invalidCreateConversationJsonResponse.json(), {
    error: 'Invalid JSON body',
  });

  const missingCharacterIdResponse = await handlers.createConversation(
    new Request('http://localhost/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(missingCharacterIdResponse.status, 400);
  assert.deepEqual(await missingCharacterIdResponse.json(), {
    error: 'characterId is required',
  });

  const getConversationResponse = await handlers.getConversation(
    new Request('http://localhost/api/conversations/conversation_1'),
    { params: Promise.resolve({ conversationId: 'conversation_1' }) },
  );
  assert.equal(getConversationResponse.status, 200);
  assert.deepEqual(await getConversationResponse.json(), {
    conversation: {
      id: 'conversation_1',
      characterId: 'uncle',
    },
    messages: [],
  });

  conversationDetailResult = null;
  const missingConversationResponse = await handlers.getConversation(
    new Request('http://localhost/api/conversations/conversation_1'),
    { params: Promise.resolve({ conversationId: 'conversation_1' }) },
  );
  assert.equal(missingConversationResponse.status, 404);
  assert.deepEqual(await missingConversationResponse.json(), {
    error: 'Conversation not found',
  });
  conversationDetailResult = {
    conversation: {
      id: 'conversation_1',
      characterId: 'uncle',
    },
    messages: [],
  };

  const syncMessagesResponse = await handlers.syncMessages(
    new Request('http://localhost/api/conversations/conversation_1/messages/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId: 'uncle',
        messages: [
          {
            id: 'message_1',
            role: 'user',
            content: '你好',
            timestamp: 1713600000000,
          },
        ],
      }),
    }),
    { params: Promise.resolve({ conversationId: 'conversation_1' }) },
  );
  assert.equal(syncMessagesResponse.status, 200);
  assert.deepEqual(await syncMessagesResponse.json(), {
    success: true,
    conversationId: 'conversation_1',
    persistedCount: 1,
  });

  const invalidSyncJsonResponse = await handlers.syncMessages(
    new Request('http://localhost/api/conversations/conversation_1/messages/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    }),
    { params: Promise.resolve({ conversationId: 'conversation_1' }) },
  );
  assert.equal(invalidSyncJsonResponse.status, 400);
  assert.deepEqual(await invalidSyncJsonResponse.json(), {
    error: 'Invalid JSON body',
  });

  const missingSyncFieldsResponse = await handlers.syncMessages(
    new Request('http://localhost/api/conversations/conversation_1/messages/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: 'uncle' }),
    }),
    { params: Promise.resolve({ conversationId: 'conversation_1' }) },
  );
  assert.equal(missingSyncFieldsResponse.status, 400);
  assert.deepEqual(await missingSyncFieldsResponse.json(), {
    error: 'characterId and messages are required',
  });

  const invalidSyncMessagesPayloadResponse = await handlers.syncMessages(
    new Request('http://localhost/api/conversations/conversation_1/messages/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId: 'uncle',
        messages: [
          {
            id: 'message_2',
            role: 'system',
            content: 'bad role',
            timestamp: '1713600000000',
          },
        ],
      }),
    }),
    { params: Promise.resolve({ conversationId: 'conversation_1' }) },
  );
  assert.equal(invalidSyncMessagesPayloadResponse.status, 400);
  assert.deepEqual(await invalidSyncMessagesPayloadResponse.json(), {
    error: 'messages must be an array of valid conversation messages',
  });

  syncConversationError = new Error('Conversation not found');
  const missingSyncConversationResponse = await handlers.syncMessages(
    new Request('http://localhost/api/conversations/conversation_1/messages/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId: 'uncle',
        messages: [
          {
            id: 'message_1',
            role: 'user',
            content: '你好',
            timestamp: 1713600000000,
          },
        ],
      }),
    }),
    { params: Promise.resolve({ conversationId: 'conversation_1' }) },
  );
  assert.equal(missingSyncConversationResponse.status, 404);
  assert.deepEqual(await missingSyncConversationResponse.json(), {
    error: 'Conversation not found',
  });
  syncConversationError = null;

  console.log('conversation route handlers test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
