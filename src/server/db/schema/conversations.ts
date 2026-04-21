import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth';

export const conversations = pgTable(
  'paper_boyfriend_conversations',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: text('character_id').notNull(),
    title: text('title'),
    lastMessagePreview: text('last_message_preview'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  table => ({
    userUpdatedAtIdx: index('paper_boyfriend_conversations_user_updated_at_idx').on(
      table.userId,
      table.updatedAt,
    ),
  }),
);

export const conversationMessages = pgTable(
  'paper_boyfriend_conversation_messages',
  {
    id: text('id').primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').$type<'user' | 'assistant'>().notNull(),
    content: text('content').notNull(),
    type: text('type').$type<'text' | 'image' | 'video'>(),
    mediaUrl: text('media_url'),
    videoRequestId: text('video_request_id'),
    videoStatus: text('video_status').$type<'pending' | 'completed' | 'failed'>(),
    pendingCaption: text('pending_caption'),
    mediaKind: text('media_kind').$type<'dance' | 'workout'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  table => ({
    conversationCreatedAtIdx: index(
      'paper_boyfriend_conversation_messages_conversation_created_at_idx',
    ).on(table.conversationId, table.createdAt),
  }),
);
