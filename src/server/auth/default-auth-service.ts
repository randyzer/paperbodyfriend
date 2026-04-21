import { createAuthService } from './auth-service';
import { getServerEnv } from '@/server/env';

let cachedAuthService: ReturnType<typeof createAuthService> | null = null;

export async function getAuthService() {
  if (cachedAuthService) {
    return cachedAuthService;
  }

  const authEnv = getServerEnv();
  const { authSessionRepository, authUserRepository } = await import(
    '@/server/auth/auth-repository'
  );
  cachedAuthService = createAuthService({
    users: authUserRepository,
    sessions: authSessionRepository,
    sessionTtlMs: authEnv.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });

  return cachedAuthService;
}
