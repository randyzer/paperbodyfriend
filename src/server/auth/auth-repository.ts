import { and, eq, gt, isNull } from 'drizzle-orm';

import {
  type AuthSessionRecord,
  type AuthUserRecord,
} from '@/server/auth/auth-service';
import { db } from '@/server/db/client';
import { authSessions, users } from '@/server/db/schema';

export const authUserRepository = {
  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  },

  async findById(id: string): Promise<AuthUserRecord | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  },

  async create(input: AuthUserRecord): Promise<AuthUserRecord> {
    const [createdUser] = await db.insert(users).values(input).returning();
    return createdUser;
  },

  async touchLastLogin(userId: string, at: Date): Promise<void> {
    await db
      .update(users)
      .set({
        lastLoginAt: at,
        updatedAt: at,
      })
      .where(eq(users.id, userId));
  },
};

export const authSessionRepository = {
  async create(
    input: Omit<AuthSessionRecord, 'revokedAt'>,
  ): Promise<AuthSessionRecord> {
    const [createdSession] = await db
      .insert(authSessions)
      .values({
        ...input,
        revokedAt: null,
      })
      .returning();

    return createdSession;
  },

  async findActiveByTokenHash(
    tokenHash: string,
    lookupAt: Date,
  ): Promise<{ session: AuthSessionRecord; user: AuthUserRecord } | null> {
    const [joinedRecord] = await db
      .select({
        session: authSessions,
        user: users,
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, lookupAt),
        ),
      )
      .limit(1);

    return joinedRecord ?? null;
  },

  async revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    await db
      .update(authSessions)
      .set({
        revokedAt,
      })
      .where(eq(authSessions.tokenHash, tokenHash));
  },

  async touchLastSeen(sessionId: string, seenAt: Date): Promise<void> {
    await db
      .update(authSessions)
      .set({
        lastSeenAt: seenAt,
      })
      .where(eq(authSessions.id, sessionId));
  },
};
