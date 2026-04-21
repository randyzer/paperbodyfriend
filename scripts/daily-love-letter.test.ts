import assert from 'node:assert/strict';

async function main() {
  const { createEmailService, sendWithResendClient } = await import('../src/lib/email');

  const sent: Array<{ from: string; to: string; subject: string; html: string }> = [];
  const generatedInputs: Array<{ userName: string; characterId?: string }> = [];

  const service = createEmailService({
    getFromEmail: () => '纸片人男友 <hello@example.com>',
    getAppBaseUrl: () => 'https://paperboyfriend.example.com',
    async sendEmail(input) {
      sent.push({
        from: input.from,
        to: String(input.to),
        subject: input.subject,
        html: String(input.html),
      });
    },
    async findLatestCharacterId() {
      return 'sunshine';
    },
    async generateLoveLetter(input) {
      generatedInputs.push(input);
      return '今天也想抱抱你。';
    },
  });

  await service.sendWelcomeEmail('user@example.com', 'Randy');
  await service.sendDailyLoveLetter({
    userId: 'user_1',
    userEmail: 'user@example.com',
    userName: 'Randy',
  });

  assert.deepEqual(sent[0], {
    from: '纸片人男友 <hello@example.com>',
    to: 'user@example.com',
    subject: '你好呀，我是你的专属男友 💌',
    html: sent[0]?.html ?? '',
  });
  assert.match(sent[0]?.html ?? '', /Hi Randy/);
  assert.equal(generatedInputs[0]?.userName, 'Randy');
  assert.equal(generatedInputs[0]?.characterId, 'sunshine');
  assert.equal(sent[1]?.to, 'user@example.com');
  assert.match(sent[1]?.subject ?? '', /早安 Randy/);
  assert.match(sent[1]?.html ?? '', /今天也想抱抱你/);
  assert.match(sent[1]?.html ?? '', /paperboyfriend\.example\.com/);

  const fallbackInputs: Array<{ userName: string; characterId?: string }> = [];
  const fallbackService = createEmailService({
    getFromEmail: () => '纸片人男友 <hello@example.com>',
    getAppBaseUrl: () => 'https://paperboyfriend.example.com',
    async sendEmail() {},
    async findLatestCharacterId() {
      return null;
    },
    async generateLoveLetter(input) {
      fallbackInputs.push(input);
      return '晚点也要记得想我。';
    },
  });

  await fallbackService.sendDailyLoveLetter({
    userId: 'user_2',
    userEmail: 'fallback@example.com',
    userName: 'Fallback',
  });

  assert.deepEqual(fallbackInputs[0], {
    userName: 'Fallback',
    characterId: undefined,
  });

  const batchSent: string[] = [];
  const batchGenerated: Array<{ userName: string; characterId?: string }> = [];
  const batchErrors: Array<{ message: string; error: unknown }> = [];
  const batchService = createEmailService({
    getFromEmail: () => '纸片人男友 <hello@example.com>',
    getAppBaseUrl: () => 'https://paperboyfriend.example.com',
    async listUsers() {
      return [
        {
          id: 'user_batch_1',
          email: 'first@example.com',
          displayName: 'First',
        },
        {
          id: 'user_batch_2',
          email: 'second@example.com',
          displayName: null,
        },
        {
          id: 'user_batch_3',
          email: 'third@example.com',
          displayName: 'Third',
        },
      ];
    },
    async findLatestCharacterId(userId) {
      if (userId === 'user_batch_1') {
        return 'uncle';
      }

      if (userId === 'user_batch_3') {
        return 'straight_man';
      }

      return null;
    },
    async generateLoveLetter(input) {
      batchGenerated.push(input);
      return `给 ${input.userName} 的今日情话`;
    },
    async sendEmail(input) {
      batchSent.push(String(input.to));

      if (String(input.to) === 'second@example.com') {
        throw new Error('mail failed');
      }
    },
    logError(message, error) {
      batchErrors.push({ message, error });
    },
  });

  await batchService.sendDailyLoveLetterToAll();

  assert.deepEqual(batchSent, [
    'first@example.com',
    'second@example.com',
    'third@example.com',
  ]);
  assert.deepEqual(batchGenerated, [
    {
      userName: 'First',
      characterId: 'uncle',
    },
    {
      userName: 'second@example.com',
      characterId: undefined,
    },
    {
      userName: 'Third',
      characterId: 'straight_man',
    },
  ]);
  assert.equal(batchErrors.length, 1);
  assert.match(batchErrors[0]?.message ?? '', /second@example\.com/);
  assert.match(String(batchErrors[0]?.error), /mail failed/);

  await assert.rejects(
    sendWithResendClient(
      {
        emails: {
          async send() {
            return {
              error: {
                message: 'testing emails can only be sent to your own email address',
              },
            };
          },
        },
      },
      {
        from: '纸片人男友 <onboarding@resend.dev>',
        to: 'other@example.com',
        subject: 'hello',
        html: '<p>hi</p>',
      },
    ),
    /testing emails can only be sent to your own email address/,
  );

  console.log('daily love letter test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
