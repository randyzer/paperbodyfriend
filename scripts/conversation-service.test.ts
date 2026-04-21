import assert from 'node:assert/strict';

type StoredConversation = {
  id: string;
  userId: string;
  characterId: string;
  title: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

type StoredMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image' | 'video' | null;
  mediaUrl: string | null;
  audioUrl: string | null;
  videoRequestId: string | null;
  videoStatus: 'pending' | 'completed' | 'failed' | null;
  pendingCaption: string | null;
  mediaKind: 'dance' | 'workout' | null;
  createdAt: Date;
};

async function main() {
  const { createConversationService } = await import(
    '../src/server/conversations/conversation-service'
  );

  const conversations = new Map<string, StoredConversation>();
  const messages: StoredMessage[] = [];
  const fixedNow = new Date('2026-04-20T10:00:00.000Z');
  let nextConversationId = 1;

  const service = createConversationService({
    now: () => fixedNow,
    createConversationId: () => `conversation_${nextConversationId++}`,
    repository: {
      async findLatestActiveConversationByUserId(userId: string) {
        const matched = [...conversations.values()]
          .filter(conversation => conversation.userId === userId)
          .filter(conversation => conversation.archivedAt === null)
          .sort(
            (left, right) =>
              right.updatedAt.getTime() - left.updatedAt.getTime(),
          );

        return matched[0] ?? null;
      },
      async createConversation(input) {
        const conversation: StoredConversation = {
          id: input.id,
          userId: input.userId,
          characterId: input.characterId,
          title: input.title,
          lastMessagePreview: input.lastMessagePreview,
          lastMessageAt: input.lastMessageAt,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
          archivedAt: input.archivedAt,
        };

        conversations.set(conversation.id, conversation);

        return conversation;
      },
      async findConversationById(userId: string, conversationId: string) {
        const conversation = conversations.get(conversationId);
        if (!conversation || conversation.userId !== userId) {
          return null;
        }

        return conversation;
      },
      async listMessages(conversationId: string) {
        return messages
          .filter(message => message.conversationId === conversationId)
          .sort(
            (left, right) =>
              left.createdAt.getTime() - right.createdAt.getTime(),
          );
      },
      async upsertMessages(input) {
        for (const message of input.messages) {
          messages.push({
            id: message.id,
            conversationId: message.conversationId,
            role: message.role,
            content: message.content,
            type: message.type,
            mediaUrl: message.mediaUrl,
            audioUrl: message.audioUrl,
            videoRequestId: message.videoRequestId,
            videoStatus: message.videoStatus,
            pendingCaption: message.pendingCaption,
            mediaKind: message.mediaKind,
            createdAt: message.createdAt,
          });
        }

        return input.messages.length;
      },
      async touchConversation(input) {
        const conversation = conversations.get(input.conversationId);
        if (!conversation) {
          return;
        }

        conversation.lastMessagePreview = input.lastMessagePreview;
        conversation.lastMessageAt = input.lastMessageAt;
        conversation.updatedAt = input.updatedAt;
      },
    },
  });

  const createdConversation = await service.createConversation({
    userId: 'user_1',
    characterId: 'uncle',
  });

  assert.equal(createdConversation.characterId, 'uncle');

  const syncResult = await service.syncConversationMessages({
    userId: 'user_1',
    conversationId: createdConversation.id,
    characterId: 'uncle',
    messages: [
      {
        id: 'message_newer',
        role: 'assistant',
        content: '后来但更新的消息',
        timestamp: 1713603600000,
      },
      {
        id: 'message_older',
        role: 'user',
        content: '先到的消息',
        timestamp: 1713600000000,
      },
    ],
  });

  assert.equal(syncResult.persistedCount, 2);
  assert.equal(
    conversations.get(createdConversation.id)?.lastMessagePreview,
    '后来但更新的消息',
  );
  assert.equal(
    conversations.get(createdConversation.id)?.lastMessageAt.toISOString(),
    new Date(1713603600000).toISOString(),
  );

  await assert.rejects(
    service.syncConversationMessages({
      userId: 'user_1',
      conversationId: createdConversation.id,
      characterId: 'other-character',
      messages: [],
    }),
    /Conversation not found/,
  );

  await assert.rejects(
    service.syncConversationMessages({
      userId: 'user_1',
      conversationId: 'missing_conversation',
      characterId: 'uncle',
      messages: [],
    }),
    /Conversation not found/,
  );

  const detailConversation = await service.createConversation({
    userId: 'user_1',
    characterId: 'uncle',
  });

  await service.syncConversationMessages({
    userId: 'user_1',
    conversationId: detailConversation.id,
    characterId: 'uncle',
    messages: [
      {
        id: 'message_with_media',
        role: 'assistant',
        content: '带媒体的消息',
        timestamp: 1713607200000,
        type: 'image',
        mediaUrl: 'https://example.com/image.png',
        audioUrl: 'https://example.com/audio.mp3',
      },
    ],
  });

  const detailWithMedia = await service.getConversationDetail({
    userId: 'user_1',
    conversationId: detailConversation.id,
  });

  const resumeCandidate = await service.getResumeCandidate('user_1');

  assert.equal(resumeCandidate?.conversationId, createdConversation.id);
  assert.equal(resumeCandidate?.characterId, 'uncle');

  const conversationDetail = await service.getConversationDetail({
    userId: 'user_1',
    conversationId: createdConversation.id,
  });

  assert.equal(conversationDetail?.messages.length, 2);
  assert.equal(conversationDetail?.messages[0]?.content, '先到的消息');
  assert.equal(conversationDetail?.messages[0]?.mediaUrl, undefined);
  assert.equal(conversationDetail?.messages[0]?.audioUrl, undefined);
  assert.equal(conversationDetail?.messages[0]?.videoRequestId, undefined);
  assert.equal(conversationDetail?.messages[0]?.videoStatus, undefined);
  assert.equal(conversationDetail?.messages[0]?.pendingCaption, undefined);
  assert.equal(conversationDetail?.messages[0]?.mediaKind, undefined);
  assert.equal(conversationDetail?.messages[1]?.content, '后来但更新的消息');
  assert.equal(detailWithMedia?.messages[0]?.mediaUrl, 'https://example.com/image.png');
  assert.equal(detailWithMedia?.messages[0]?.audioUrl, 'https://example.com/audio.mp3');
  assert.equal(detailWithMedia?.messages[0]?.videoRequestId, undefined);
  assert.equal(detailWithMedia?.messages[0]?.videoStatus, undefined);
  assert.equal(detailWithMedia?.messages[0]?.pendingCaption, undefined);
  assert.equal(detailWithMedia?.messages[0]?.mediaKind, undefined);

  const dedupConversation = await service.createConversation({
    userId: 'user_1',
    characterId: 'uncle',
  });

  const dedupSyncResult = await service.syncConversationMessages({
    userId: 'user_1',
    conversationId: dedupConversation.id,
    characterId: 'uncle',
    messages: [
      {
        id: 'message_1',
        role: 'assistant',
        content: '重复的更新版本',
        timestamp: 1713610860000,
      },
      {
        id: 'message_1',
        role: 'user',
        content: '重复的旧版本',
        timestamp: 1713610800000,
      },
    ],
  });

  assert.equal(dedupSyncResult.persistedCount, 1);

  const detailAfterDedup = await service.getConversationDetail({
    userId: 'user_1',
    conversationId: dedupConversation.id,
  });

  assert.equal(detailAfterDedup?.messages.length, 1);
  assert.equal(detailAfterDedup?.messages[0]?.content, '重复的更新版本');

  const identicalDuplicateConversation = await service.createConversation({
    userId: 'user_1',
    characterId: 'uncle',
  });

  const identicalDuplicateSyncResult = await service.syncConversationMessages({
    userId: 'user_1',
    conversationId: identicalDuplicateConversation.id,
    characterId: 'uncle',
    messages: [
      {
        id: 'message_same_timestamp',
        role: 'assistant',
        content: '同一条重传消息',
        timestamp: 1713614400000,
        type: 'text',
      },
      {
        id: 'message_same_timestamp',
        role: 'assistant',
        content: '同一条重传消息',
        timestamp: 1713614400000,
        type: 'text',
      },
    ],
  });

  assert.equal(identicalDuplicateSyncResult.persistedCount, 1);

  const identicalDuplicateDetail = await service.getConversationDetail({
    userId: 'user_1',
    conversationId: identicalDuplicateConversation.id,
  });

  assert.equal(identicalDuplicateDetail?.messages.length, 1);
  assert.equal(
    identicalDuplicateDetail?.messages[0]?.content,
    '同一条重传消息',
  );

  const conflictingDuplicateConversation = await service.createConversation({
    userId: 'user_1',
    characterId: 'uncle',
  });

  await assert.rejects(
    service.syncConversationMessages({
      userId: 'user_1',
      conversationId: conflictingDuplicateConversation.id,
      characterId: 'uncle',
      messages: [
        {
          id: 'message_conflict',
          role: 'assistant',
          content: '第一个版本',
          timestamp: 1713618000000,
        },
        {
          id: 'message_conflict',
          role: 'assistant',
          content: '第二个版本',
          timestamp: 1713618000000,
        },
      ],
    }),
    /Conflicting duplicate message id/,
  );

  await assert.rejects(
    service.syncConversationMessages({
      userId: 'user_1',
      conversationId: conflictingDuplicateConversation.id,
      characterId: 'uncle',
      messages: [
        {
          id: 'message_conflict',
          role: 'assistant',
          content: '第二个版本',
          timestamp: 1713618000000,
        },
        {
          id: 'message_conflict',
          role: 'assistant',
          content: '第一个版本',
          timestamp: 1713618000000,
        },
      ],
    }),
    /Conflicting duplicate message id/,
  );

  console.log('conversation service test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
