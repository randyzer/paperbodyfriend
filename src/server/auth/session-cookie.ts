export const DEFAULT_SESSION_COOKIE_NAME = 'paperboyfriend_session';

export function getSessionCookieName(): string {
  const value = process.env.AUTH_SESSION_COOKIE_NAME?.trim();
  return value && value.length > 0 ? value : DEFAULT_SESSION_COOKIE_NAME;
}

export function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}

export function buildExpiredSessionCookieOptions() {
  return {
    ...buildSessionCookieOptions(new Date(0)),
    maxAge: 0,
  };
}
