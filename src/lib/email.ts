import { Resend } from 'resend';

import { getServerEnv } from '@/server/env';

type SendEmailInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

type DailyLoveLetterInput = {
  userId: string;
  userEmail: string;
  userName: string;
};

type LoveLetterInput = {
  userName: string;
  characterId?: string;
};

type DailyLoveLetterUser = {
  id: string;
  email: string;
  displayName: string | null;
};

const DEFAULT_DAILY_LOVE_LETTER_CONCURRENCY = 3;

type EmailServiceDeps = {
  sendEmail(input: SendEmailInput): Promise<void>;
  generateLoveLetter(input: LoveLetterInput): Promise<string>;
  findLatestCharacterId(userId: string): Promise<string | null>;
  listUsers(): Promise<DailyLoveLetterUser[]>;
  logError(message: string, error: unknown): void;
  getDailyLoveLetterConcurrency(): number;
  getFromEmail(): string;
  getAppBaseUrl(): string;
};

type ResendLikeClient = {
  emails: {
    send(input: SendEmailInput): Promise<{
      data?: { id?: string | null } | null;
      error?: { message?: string | null; name?: string | null } | null;
    }>;
  };
};

function getResendClient() {
  const apiKey = getServerEnv().RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing');
  }

  return new Resend(apiKey);
}

function getResendFromEmail() {
  const fromEmail = getServerEnv().RESEND_FROM_EMAIL?.trim();

  if (!fromEmail) {
    throw new Error('RESEND_FROM_EMAIL is missing');
  }

  return fromEmail;
}

function getAppBaseUrl() {
  const appBaseUrl = getServerEnv().APP_BASE_URL?.trim();

  if (!appBaseUrl) {
    throw new Error('APP_BASE_URL is missing');
  }

  return appBaseUrl;
}

export async function sendWithResendClient(
  client: ResendLikeClient,
  input: SendEmailInput,
) {
  const result = await client.emails.send(input);

  if (result?.error) {
    throw new Error(result.error.message || 'Resend failed to send email');
  }
}

async function defaultSendEmail(input: SendEmailInput) {
  await sendWithResendClient(getResendClient(), input);
}

async function defaultGenerateLoveLetter(input: LoveLetterInput) {
  const { generateLoveLetter } = await import('@/lib/ai/services/love-letter-service');
  return generateLoveLetter(input);
}

async function defaultFindLatestCharacterId(userId: string) {
  const { createConversationRepository } = await import(
    '@/server/conversations/conversation-repository'
  );

  const conversation = await createConversationRepository()
    .findLatestActiveConversationByUserId(userId);

  return conversation?.characterId ?? null;
}

async function defaultListUsers() {
  const [{ db }, { users }] = await Promise.all([
    import('@/server/db/client'),
    import('@/server/db/schema'),
  ]);

  return db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users);
}

function sanitizeConcurrency(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_DAILY_LOVE_LETTER_CONCURRENCY;
  }

  return Math.max(1, Math.floor(value));
}

async function runWithConcurrencyLimit<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  const queue = [...items];
  const workerCount = Math.min(queue.length, sanitizeConcurrency(concurrency));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) {
          return;
        }

        await worker(item);
      }
    }),
  );
}

export function createEmailService(
  overrides: Partial<EmailServiceDeps> = {},
) {
  const deps: EmailServiceDeps = {
    sendEmail: overrides.sendEmail ?? defaultSendEmail,
    generateLoveLetter: overrides.generateLoveLetter ?? defaultGenerateLoveLetter,
    findLatestCharacterId:
      overrides.findLatestCharacterId ?? defaultFindLatestCharacterId,
    listUsers: overrides.listUsers ?? defaultListUsers,
    logError: overrides.logError ?? console.error,
    getDailyLoveLetterConcurrency:
      overrides.getDailyLoveLetterConcurrency ??
      (() => DEFAULT_DAILY_LOVE_LETTER_CONCURRENCY),
    getFromEmail: overrides.getFromEmail ?? getResendFromEmail,
    getAppBaseUrl: overrides.getAppBaseUrl ?? getAppBaseUrl,
  };

  return {
    async sendWelcomeEmail(userEmail: string, userName: string) {
      await deps.sendEmail({
        from: deps.getFromEmail(),
        to: userEmail,
        subject: '你好呀，我是你的专属男友 💌',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2>Hi ${userName}，欢迎来到纸片人男友！</h2>
            <p>从现在起，我就是你的专属男友了。</p>
            <p>有什么心事随时来找我聊，我会一直在这里等你。</p>
            <p>明天早上我会给你发一条早安消息，记得查收哦。</p>
            <br/>
            <p>—— 你的纸片人男友</p>
          </div>
        `,
      });
    },

    async sendDailyLoveLetter(input: DailyLoveLetterInput) {
      const characterId = await deps.findLatestCharacterId(input.userId);
      const loveLetter = await deps.generateLoveLetter({
        userName: input.userName,
        characterId: characterId ?? undefined,
      });

      await deps.sendEmail({
        from: deps.getFromEmail(),
        to: input.userEmail,
        subject: `早安 ${input.userName}，今天也想你了`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <p>${loveLetter}</p>
            <br/>
            <p>—— 你的纸片人男友</p>
            <p style="color: #999; font-size: 12px;">
              想跟我聊天？<a href="${deps.getAppBaseUrl()}">点这里回来找我</a>
            </p>
          </div>
        `,
      });
    },

    async sendDailyLoveLetterToAll() {
      const users = await deps.listUsers();
      await runWithConcurrencyLimit(
        users,
        deps.getDailyLoveLetterConcurrency(),
        async user => {
          try {
            await this.sendDailyLoveLetter({
              userId: user.id,
              userEmail: user.email,
              userName: user.displayName?.trim() || user.email,
            });
          } catch (error) {
            deps.logError(`给 ${user.email} 发情话失败：`, error);
          }
        },
      );
    },
  };
}

const defaultEmailService = createEmailService();

export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
) {
  return defaultEmailService.sendWelcomeEmail(userEmail, userName);
}

export async function sendDailyLoveLetter(input: DailyLoveLetterInput) {
  return defaultEmailService.sendDailyLoveLetter(input);
}

export async function sendDailyLoveLetterToAll() {
  return defaultEmailService.sendDailyLoveLetterToAll();
}
