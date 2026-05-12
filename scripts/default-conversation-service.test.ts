import assert from 'node:assert/strict';

async function main() {
  delete process.env.AUTH_TEST_BYPASS;
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/test';

  const { getConversationService } = await import(
    '../src/server/conversations/default-conversation-service'
  );

  const service = getConversationService();

  assert.equal(typeof service.createConversation, 'function');
  assert.equal(typeof service.getConversationDetail, 'function');
  assert.equal(typeof service.syncConversationMessages, 'function');
}

void main();
