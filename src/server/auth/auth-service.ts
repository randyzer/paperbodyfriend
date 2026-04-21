import { hashPassword, verifyPassword } from './password';
import { createSessionToken, hashSessionToken } from './session-token';

export type AuthErrorCode =
  | 'BAD_REQUEST'
  | 'EMAIL_ALREADY_USED'
  | 'INVALID_CREDENTIALS'
  | 'USER_DISABLED';

export class AuthError extends Error {
  code: AuthErrorCode;
  statusCode: number;
  userMessage: string;

  constructor(code: AuthErrorCode, message: string, statusCode: number, userMessage: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
    this.userMessage = userMessage;
  }
}

export type AuthUserRecord = {
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

export type AuthSessionRecord = {
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

export type AuthPublicUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type UserRepository = {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  create(input: AuthUserRecord): Promise<AuthUserRecord>;
  touchLastLogin(userId: string, at: Date): Promise<void>;
  updateAvatar(userId: string, avatarUrl: string | null): Promise<AuthUserRecord | null>;
};

type SessionRepository = {
  create(input: Omit<AuthSessionRecord, 'revokedAt'>): Promise<AuthSessionRecord>;
  findActiveByTokenHash(
    tokenHash: string,
    lookupAt: Date,
  ): Promise<{ session: AuthSessionRecord; user: AuthUserRecord } | null>;
  revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
  touchLastSeen(sessionId: string, seenAt: Date): Promise<void>;
};

type CreateAuthServiceOptions = {
  users: UserRepository;
  sessions: SessionRepository;
  now?: () => Date;
  sessionTtlMs?: number;
  createUserId?: () => string;
  createSessionId?: () => string;
  createSessionToken?: () => string;
};

type RegisterInput = {
  email: string;
  password: string;
  displayName?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
};

type LoginInput = {
  email: string;
  password: string;
  userAgent?: string | null;
  ipAddress?: string | null;
};

type AuthResult = {
  user: AuthPublicUser;
  sessionToken: string;
  expiresAt: Date;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(displayName?: string | null): string | null {
  if (typeof displayName !== 'string') {
    return null;
  }

  const trimmed = displayName.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPublicUser(user: AuthUserRecord): AuthPublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

function assertCredentials(email: string, password: string) {
  if (!email.includes('@') || password.length < 8) {
    throw new AuthError(
      'BAD_REQUEST',
      'Invalid auth payload',
      400,
      '注册或登录信息不完整，请检查后重试。',
    );
  }
}

export function createAuthService(options: CreateAuthServiceOptions) {
  const now = options.now ?? (() => new Date());
  const sessionTtlMs = options.sessionTtlMs ?? 1000 * 60 * 60 * 24 * 30;
  const createUserId = options.createUserId ?? (() => crypto.randomUUID());
  const createSessionId = options.createSessionId ?? (() => crypto.randomUUID());
  const createRawSessionToken = options.createSessionToken ?? createSessionToken;

  async function createUserSession(
    user: AuthUserRecord,
    input: { userAgent?: string | null; ipAddress?: string | null },
  ): Promise<AuthResult> {
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + sessionTtlMs);
    const sessionToken = createRawSessionToken();

    await options.sessions.create({
      id: createSessionId(),
      userId: user.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
      createdAt,
      lastSeenAt: createdAt,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
    });

    return {
      user: toPublicUser(user),
      sessionToken,
      expiresAt,
    };
  }

  return {
    async register(input: RegisterInput): Promise<AuthResult> {
      const email = normalizeEmail(input.email);
      assertCredentials(email, input.password);

      const existingUser = await options.users.findByEmail(email);
      if (existingUser) {
        throw new AuthError(
          'EMAIL_ALREADY_USED',
          'Email already used',
          409,
          '这个邮箱已经注册过了，请直接登录。',
        );
      }

      const createdAt = now();
      const user = await options.users.create({
        id: createUserId(),
        email,
        passwordHash: await hashPassword(input.password),
        displayName: normalizeDisplayName(input.displayName),
        avatarUrl: null,
        status: 'active',
        createdAt,
        updatedAt: createdAt,
        lastLoginAt: null,
      });

      return createUserSession(user, input);
    },

    async login(input: LoginInput): Promise<AuthResult> {
      const email = normalizeEmail(input.email);
      assertCredentials(email, input.password);

      const user = await options.users.findByEmail(email);
      if (!user) {
        throw new AuthError(
          'INVALID_CREDENTIALS',
          'Unknown email',
          401,
          '邮箱或密码不正确。',
        );
      }

      if (user.status !== 'active') {
        throw new AuthError(
          'USER_DISABLED',
          'User disabled',
          403,
          '当前账号已被禁用，请联系管理员。',
        );
      }

      const passwordValid = await verifyPassword(input.password, user.passwordHash);
      if (!passwordValid) {
        throw new AuthError(
          'INVALID_CREDENTIALS',
          'Invalid password',
          401,
          '邮箱或密码不正确。',
        );
      }

      const loggedInAt = now();
      await options.users.touchLastLogin(user.id, loggedInAt);

      const freshUser = (await options.users.findById(user.id)) ?? {
        ...user,
        lastLoginAt: loggedInAt,
        updatedAt: loggedInAt,
      };

      return createUserSession(freshUser, input);
    },

    async getSessionByToken(token: string | null | undefined) {
      if (!token) {
        return null;
      }

      const found = await options.sessions.findActiveByTokenHash(
        hashSessionToken(token),
        now(),
      );

      if (!found || found.user.status !== 'active') {
        return null;
      }

      await options.sessions.touchLastSeen(found.session.id, now());

      return {
        session: found.session,
        user: toPublicUser(found.user),
      };
    },

    async logout(token: string | null | undefined): Promise<void> {
      if (!token) {
        return;
      }

      await options.sessions.revokeByTokenHash(hashSessionToken(token), now());
    },

    async updateAvatar(input: { userId: string; avatarUrl: string | null }) {
      const updatedUser = await options.users.updateAvatar(input.userId, input.avatarUrl);

      if (!updatedUser) {
        throw new AuthError(
          'INVALID_CREDENTIALS',
          'User not found',
          404,
          '当前用户不存在，请重新登录后重试。',
        );
      }

      return toPublicUser(updatedUser);
    },
  };
}
