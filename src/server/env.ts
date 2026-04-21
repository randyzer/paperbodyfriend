import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SESSION_COOKIE_NAME: z.string().optional(),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  APP_BASE_URL: z.string().optional(),
});

let cachedEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.parse(process.env);
  cachedEnv = {
    ...parsed,
    AUTH_SESSION_COOKIE_NAME:
      parsed.AUTH_SESSION_COOKIE_NAME?.trim() || 'paperboyfriend_session',
  };

  return cachedEnv;
}
