import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import type {
  ConversationMessageRecord,
  ConversationRecord,
} from '@/server/conversations/conversation-service';
import { db } from '@/server/db/client';
import { conversationMessages, conversations } from '@/server/db/schema';

export function createConversationRepository(database = db) {
  return {
    async findLatestActiveConversationByUserId(
      userId: string,
    ): Promise<ConversationRecord | null> {
      const [conversation] = await database
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            isNull(conversations.archivedAt),
          ),
        )
        .orderBy(desc(conversations.updatedAt))
        .limit(1);

      return conversation ?? null;
    },

    async createConversation(input: ConversationRecord): Promise<ConversationRecord> {
      const [conversation] = await database
        .insert(conversations)
        .values(input)
        .returning();

      return conversation;
    },

    async findConversationById(
      userId: string,
      conversationId: string,
    ): Promise<ConversationRecord | null> {
      const [conversation] = await database
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, userId),
          ),
        )
        .limit(1);

      return conversation ?? null;
    },

    async listMessages(conversationId: string): Promise<ConversationMessageRecord[]> {
      return database
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, conversationId))
        .orderBy(asc(conversationMessages.createdAt));
    },

    async upsertMessages(input: {
      conversationId: string;
      messages: ConversationMessageRecord[];
    }): Promise<number> {
      if (input.messages.length === 0) {
        return 0;
      }

      await database
        .insert(conversationMessages)
        .values(input.messages)
        .onConflictDoNothing({
          target: conversationMessages.id,
        });

      return input.messages.length;
    },

    async touchConversation(input: {
      conversationId: string;
      lastMessagePreview: string | null;
      lastMessageAt: Date;
      updatedAt: Date;
    }): Promise<void> {
      await database
        .update(conversations)
        .set({
          lastMessagePreview: input.lastMessagePreview,
          lastMessageAt: input.lastMessageAt,
          updatedAt: input.updatedAt,
        })
        .where(eq(conversations.id, input.conversationId));
    },
  };
}
