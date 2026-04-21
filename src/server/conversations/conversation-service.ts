// `id` must be a client-generated globally unique identifier for a persisted message.
export type ConversationMessageInput = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'video';
  mediaUrl?: string;
  videoRequestId?: string;
  videoStatus?: 'pending' | 'completed' | 'failed';
  pendingCaption?: string;
  mediaKind?: 'dance' | 'workout';
};

export type ConversationRecord = {
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

export type ConversationMessageRecord = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image' | 'video' | null;
  mediaUrl: string | null;
  videoRequestId: string | null;
  videoStatus: 'pending' | 'completed' | 'failed' | null;
  pendingCaption: string | null;
  mediaKind: 'dance' | 'workout' | null;
  createdAt: Date;
};

export type ConversationRepository = {
  findLatestActiveConversationByUserId(userId: string): Promise<ConversationRecord | null>;
  createConversation(input: ConversationRecord): Promise<ConversationRecord>;
  findConversationById(userId: string, conversationId: string): Promise<ConversationRecord | null>;
  listMessages(conversationId: string): Promise<ConversationMessageRecord[]>;
  upsertMessages(input: {
    conversationId: string;
    messages: ConversationMessageRecord[];
  }): Promise<number>;
  touchConversation(input: {
    conversationId: string;
    lastMessagePreview: string | null;
    lastMessageAt: Date;
    updatedAt: Date;
  }): Promise<void>;
};

type CreateConversationServiceOptions = {
  repository: ConversationRepository;
  now?: () => Date;
  createConversationId?: () => string;
};

function toOptionalValue<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

function areEquivalentMessages(
  left: ConversationMessageInput,
  right: ConversationMessageInput,
) {
  return (
    left.role === right.role &&
    left.content === right.content &&
    left.type === right.type &&
    left.mediaUrl === right.mediaUrl &&
    left.videoRequestId === right.videoRequestId &&
    left.videoStatus === right.videoStatus &&
    left.pendingCaption === right.pendingCaption &&
    left.mediaKind === right.mediaKind
  );
}

export function createConversationService(options: CreateConversationServiceOptions) {
  const now = options.now ?? (() => new Date());
  const createConversationId = options.createConversationId ?? (() => crypto.randomUUID());

  return {
    async getResumeCandidate(userId: string) {
      const conversation = await options.repository.findLatestActiveConversationByUserId(
        userId,
      );

      if (!conversation) {
        return null;
      }

      return {
        conversationId: conversation.id,
        characterId: conversation.characterId,
        lastMessagePreview: conversation.lastMessagePreview,
        lastMessageAt: conversation.lastMessageAt,
      };
    },

    async createConversation(input: { userId: string; characterId: string }) {
      const createdAt = now();

      return options.repository.createConversation({
        id: createConversationId(),
        userId: input.userId,
        characterId: input.characterId,
        title: null,
        lastMessagePreview: null,
        lastMessageAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        archivedAt: null,
      });
    },

    async getConversationDetail(input: { userId: string; conversationId: string }) {
      const conversation = await options.repository.findConversationById(
        input.userId,
        input.conversationId,
      );

      if (!conversation) {
        return null;
      }

      const messages = await options.repository.listMessages(input.conversationId);

      return {
        conversation,
        messages: messages.map(message => ({
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.createdAt.getTime(),
          type: message.type,
          mediaUrl: toOptionalValue(message.mediaUrl),
          videoRequestId: toOptionalValue(message.videoRequestId),
          videoStatus: toOptionalValue(message.videoStatus),
          pendingCaption: toOptionalValue(message.pendingCaption),
          mediaKind: toOptionalValue(message.mediaKind),
        })),
      };
    },

    async syncConversationMessages(input: {
      userId: string;
      conversationId: string;
      characterId: string;
      messages: ConversationMessageInput[];
    }) {
      const conversation = await options.repository.findConversationById(
        input.userId,
        input.conversationId,
      );

      if (!conversation || conversation.characterId !== input.characterId) {
        throw new Error('Conversation not found');
      }

      const dedupedById = new Map<string, ConversationMessageInput>();
      for (const message of input.messages) {
        const existing = dedupedById.get(message.id);

        if (!existing || message.timestamp > existing.timestamp) {
          dedupedById.set(message.id, message);
          continue;
        }

        if (message.timestamp === existing.timestamp) {
          if (!areEquivalentMessages(existing, message)) {
            throw new Error('Conflicting duplicate message id');
          }
        }
      }

      const dedupedMessages = [...dedupedById.values()];

      const messageRecords = dedupedMessages.map(message => ({
        id: message.id,
        conversationId: input.conversationId,
        role: message.role,
        content: message.content,
        type: message.type ?? 'text',
        mediaUrl: message.mediaUrl ?? null,
        videoRequestId: message.videoRequestId ?? null,
        videoStatus: message.videoStatus ?? null,
        pendingCaption: message.pendingCaption ?? null,
        mediaKind: message.mediaKind ?? null,
        createdAt: new Date(message.timestamp),
      }));

      await options.repository.upsertMessages({
        conversationId: input.conversationId,
        messages: messageRecords,
      });

      const lastMessage = dedupedMessages.reduce<ConversationMessageInput | null>(
        (latest, message) => {
          if (!latest || message.timestamp > latest.timestamp) {
            return message;
          }

          return latest;
        },
        null,
      );
      if (lastMessage) {
        await options.repository.touchConversation({
          conversationId: input.conversationId,
          lastMessagePreview: lastMessage.content.slice(0, 120),
          lastMessageAt: new Date(lastMessage.timestamp),
          updatedAt: now(),
        });
      }

      return {
        conversationId: input.conversationId,
        persistedCount: messageRecords.length,
      };
    },
  };
}
