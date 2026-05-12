import { and, asc, desc, eq, isNull, lt, sql } from 'drizzle-orm';

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

    async reserveRoundTrip(input: {
      userId: string;
      conversationId: string;
      maxRoundTrips: number;
    }) {
      const [reservedConversation] = await database
        .update(conversations)
        .set({
          roundTripCount: sql`${conversations.roundTripCount} + 1`,
        })
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, input.userId),
            isNull(conversations.archivedAt),
            lt(conversations.roundTripCount, input.maxRoundTrips),
          ),
        )
        .returning({
          roundTripCount: conversations.roundTripCount,
        });

      if (reservedConversation) {
        return {
          status: 'reserved' as const,
          roundTripCount: reservedConversation.roundTripCount,
        };
      }

      const [conversation] = await database
        .select({
          id: conversations.id,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, input.userId),
            isNull(conversations.archivedAt),
          ),
        )
        .limit(1);

      if (!conversation) {
        return {
          status: 'not_found' as const,
        };
      }

      return {
        status: 'limit_reached' as const,
      };
    },

    async releaseRoundTrip(input: {
      userId: string;
      conversationId: string;
    }) {
      await database
        .update(conversations)
        .set({
          roundTripCount: sql`greatest(${conversations.roundTripCount} - 1, 0)`,
        })
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, input.userId),
          ),
        );
    },
  };
}
