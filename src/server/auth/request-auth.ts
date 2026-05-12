import { AuthError } from './auth-service';
import { getAuthService } from './default-auth-service';
import { getSessionCookieName } from './session-cookie';

function readCookieValue(request: Request, cookieName: string): string | null {
  const rawCookie = request.headers.get('cookie');
  if (!rawCookie) {
    return null;
  }

  const cookies = rawCookie.split(';').map(part => part.trim());
  const entry = cookies.find(part => part.startsWith(`${cookieName}=`));
  return entry ? decodeURIComponent(entry.slice(cookieName.length + 1)) : null;
}

export async function getAuthenticatedSession(request: Request) {
  const token = readCookieValue(request, getSessionCookieName());
  if (
    process.env.AUTH_TEST_BYPASS === 'true' &&
    token === 'test-session-token'
  ) {
    return {
      user: {
        id: 'test-user',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: null,
      },
      session: {
        id: 'test-session',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    };
  }

  return (await getAuthService()).getSessionByToken(token);
}

export async function requireAuthenticatedUser(request: Request) {
  const session = await getAuthenticatedSession(request);

  if (!session) {
    throw new AuthError(
      'INVALID_CREDENTIALS',
      'Authentication required',
      401,
      '请先登录后再继续。',
    );
  }

  return session.user;
}

export async function getOptionalAuthenticatedUser(request: Request) {
  const token = readCookieValue(request, getSessionCookieName());
  if (!token) {
    return null;
  }

  try {
    return await requireAuthenticatedUser(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return null;
    }

    throw error;
  }
}
