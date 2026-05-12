import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SESSION_COOKIE_NAME: z.string().optional(),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CHAT_ACCESS_COOKIE_SECRET: z.string().optional(),
  CREEM_API_KEY: z.string().optional(),
  CREEM_WEBHOOK_SECRET: z.string().optional(),
  CREEM_PRODUCT_ID: z.string().optional(),
  CREEM_TEST_MODE: z.enum(['true', 'false']).optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  APP_BASE_URL: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

let cachedEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.parse(process.env);
  const cronSecret = parsed.CRON_SECRET?.trim();
  const turnstileSecret = parsed.TURNSTILE_SECRET_KEY?.trim();

  cachedEnv = {
    ...parsed,
    AUTH_SESSION_COOKIE_NAME:
      parsed.AUTH_SESSION_COOKIE_NAME?.trim() || 'paperboyfriend_session',
    CHAT_ACCESS_COOKIE_SECRET:
      parsed.CHAT_ACCESS_COOKIE_SECRET?.trim() ||
      cronSecret ||
      turnstileSecret,
    CREEM_API_KEY: parsed.CREEM_API_KEY?.trim(),
    CREEM_WEBHOOK_SECRET: parsed.CREEM_WEBHOOK_SECRET?.trim(),
    CREEM_PRODUCT_ID: parsed.CREEM_PRODUCT_ID?.trim(),
    APP_BASE_URL: parsed.APP_BASE_URL?.trim(),
    CRON_SECRET: cronSecret,
    RESEND_API_KEY: parsed.RESEND_API_KEY?.trim(),
    RESEND_FROM_EMAIL: parsed.RESEND_FROM_EMAIL?.trim(),
    TURNSTILE_SECRET_KEY: turnstileSecret,
  };

  return cachedEnv;
}
