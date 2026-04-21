import assert from 'node:assert/strict';

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: 'active' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

type StoredSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
  ipAddress: string | null;
};

async function main() {
  const { hashPassword } = await import('../src/server/auth/password');
  const { createAuthService, AuthError } = await import(
    '../src/server/auth/auth-service'
  );

  const users = new Map<string, StoredUser>();
  const sessions = new Map<string, StoredSession>();
  const now = new Date('2026-04-20T08:00:00.000Z');
  let nextUserId = 1;
  let nextSessionId = 1;
  let nextSessionToken = 1;

  const authService = createAuthService({
    now: () => now,
    sessionTtlMs: 1000 * 60 * 60 * 24 * 30,
    createUserId: () => `user_${nextUserId++}`,
    createSessionId: () => `session_${nextSessionId++}`,
    createSessionToken: () => `plain-session-token-${nextSessionToken++}`,
    users: {
      async findByEmail(email: string) {
        return [...users.values()].find(user => user.email === email) ?? null;
      },
      async findById(id: string) {
        return users.get(id) ?? null;
      },
      async create(input) {
        const user: StoredUser = {
          id: input.id,
          email: input.email,
          passwordHash: input.passwordHash,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          status: input.status,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
          lastLoginAt: input.lastLoginAt,
        };
        users.set(user.id, user);
        return user;
      },
      async touchLastLogin(userId: string, at: Date) {
        const user = users.get(userId);
        if (user) {
          user.lastLoginAt = at;
          user.updatedAt = at;
        }
      },
      async updateAvatar(userId: string, avatarUrl: string | null) {
        const user = users.get(userId);
        if (!user) {
          return null;
        }

        user.avatarUrl = avatarUrl;
        user.updatedAt = now;
        return user;
      },
    },
    sessions: {
      async create(input) {
        const session: StoredSession = {
          id: input.id,
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          createdAt: input.createdAt,
          lastSeenAt: input.lastSeenAt,
          revokedAt: null,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        };
        sessions.set(session.id, session);
        return session;
      },
      async findActiveByTokenHash(tokenHash: string, lookupAt: Date) {
        const session = [...sessions.values()].find(
          item =>
            item.tokenHash === tokenHash &&
            item.revokedAt === null &&
            item.expiresAt > lookupAt,
        );

        if (!session) {
          return null;
        }

        const user = users.get(session.userId);
        return user ? { session, user } : null;
      },
      async revokeByTokenHash(tokenHash: string, revokedAt: Date) {
        const session = [...sessions.values()].find(
          item => item.tokenHash === tokenHash,
        );
        if (session) {
          session.revokedAt = revokedAt;
        }
      },
      async touchLastSeen(sessionId: string, seenAt: Date) {
        const session = sessions.get(sessionId);
        if (session) {
          session.lastSeenAt = seenAt;
        }
      },
    },
  });

  const registerResult = await authService.register({
    email: '  USER@example.com ',
    password: 'TestPass!123',
    displayName: 'Randy',
    userAgent: 'unit-test',
    ipAddress: '127.0.0.1',
  });

  assert.equal(registerResult.user.email, 'user@example.com');
  assert.equal(registerResult.user.displayName, 'Randy');
  assert.equal(registerResult.user.avatarUrl, null);
  assert.equal(registerResult.sessionToken, 'plain-session-token-1');
  assert.equal(users.size, 1);
  assert.equal(sessions.size, 1);
  assert.equal(
    [...users.values()][0]?.passwordHash === 'TestPass!123',
    false,
    'service should persist a password hash instead of plain text',
  );

  await assert.rejects(
    () =>
      authService.register({
        email: 'user@example.com',
        password: 'AnotherPass!123',
      }),
    (error: unknown) =>
      error instanceof AuthError && error.code === 'EMAIL_ALREADY_USED',
  );

  const seededUserHash = await hashPassword('AnotherPass!123');
  users.set('user_2', {
    id: 'user_2',
    email: 'login@example.com',
    passwordHash: seededUserHash,
    displayName: null,
    avatarUrl: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });

  const loginResult = await authService.login({
    email: 'login@example.com',
    password: 'AnotherPass!123',
    userAgent: 'unit-test',
    ipAddress: '127.0.0.1',
  });

  assert.equal(loginResult.user.id, 'user_2');
  assert.equal(loginResult.sessionToken, 'plain-session-token-2');

  const registeredSession = await authService.getSessionByToken(
    registerResult.sessionToken,
  );
  assert.ok(registeredSession, 'session lookup should succeed for a fresh token');
  assert.equal(registeredSession?.user.email, 'user@example.com');

  const updatedAvatarUser = await authService.updateAvatar({
    userId: 'user_2',
    avatarUrl: 'https://cdn.example.com/avatar-user-2.png',
  });
  assert.equal(
    updatedAvatarUser.avatarUrl,
    'https://cdn.example.com/avatar-user-2.png',
  );

  await assert.rejects(
    () =>
      authService.login({
        email: 'login@example.com',
        password: 'WrongPass!999',
      }),
    (error: unknown) =>
      error instanceof AuthError && error.code === 'INVALID_CREDENTIALS',
  );

  await authService.logout(registerResult.sessionToken);
  const revokedSession = await authService.getSessionByToken(
    registerResult.sessionToken,
  );
  assert.equal(revokedSession, null);

  console.log('auth service test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
