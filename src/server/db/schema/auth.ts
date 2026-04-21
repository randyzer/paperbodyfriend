import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'paper_boyfriend_users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    status: text('status').$type<'active' | 'disabled'>().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  table => ({
    emailUnique: uniqueIndex('paper_boyfriend_users_email_unique').on(table.email),
  }),
);

export const authSessions = pgTable(
  'paper_boyfriend_auth_sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
  },
  table => ({
    tokenHashUnique: uniqueIndex('paper_boyfriend_auth_sessions_token_hash_unique').on(
      table.tokenHash,
    ),
    userIdIndex: index('paper_boyfriend_auth_sessions_user_id_idx').on(table.userId),
    expiresAtIndex: index('paper_boyfriend_auth_sessions_expires_at_idx').on(table.expiresAt),
  }),
);
