import assert from 'node:assert/strict';

async function main() {
  const previousEnv = new Map<string, string | undefined>();
  const envKeys = [
    'CHAT_ACCESS_COOKIE_SECRET',
    'CRON_SECRET',
    'TURNSTILE_SECRET_KEY',
  ] as const;

  for (const key of envKeys) {
    previousEnv.set(key, process.env[key]);
    delete process.env[key];
  }

  process.env.CRON_SECRET = 'cron-fallback-secret';

  const { ChatAccessError } = await import('../src/server/access/chat-access-errors');
  const { createChatAccessService } = await import('../src/server/access/chat-access-service');
  const {
    buildAnonChatRoundsCookie,
    readAnonChatRoundsCookie,
  } = await import('../src/server/access/anon-chat-cookie');

  const service = createChatAccessService({
    async getBillingStatus(userId) {
      return {
        active: userId === 'paid-user',
      };
    },
  });

  const missingCookieState = readAnonChatRoundsCookie(null);
  assert.deepEqual(missingCookieState, {
    exists: false,
    isTampered: false,
    roundCount: 0,
  });

  const signedCookie = buildAnonChatRoundsCookie(2);
  const validCookieState = readAnonChatRoundsCookie(signedCookie);
  assert.deepEqual(validCookieState, {
    exists: true,
    isTampered: false,
    roundCount: 2,
  });

  const tamperedCookie = signedCookie.replace(
    'paper_boyfriend_anon_rounds=v1.2.',
    'paper_boyfriend_anon_rounds=v1.0.',
  );
  const tamperedCookieState = readAnonChatRoundsCookie(tamperedCookie);
  assert.deepEqual(tamperedCookieState, {
    exists: true,
    isTampered: true,
    roundCount: 0,
  });

  const anonymousTier = await service.resolveChatAccess({
    userId: null,
  });
  assert.deepEqual(anonymousTier, {
    tier: 'anonymous',
    maxRoundTrips: 3,
  });

  const anonymousAllowed = await service.assertChatAllowed({
    userId: null,
    currentRoundTripCount: 2,
  });
  assert.deepEqual(anonymousAllowed, {
    tier: 'anonymous',
    maxRoundTrips: 3,
  });

  await assert.rejects(
    () =>
      service.assertChatAllowed({
        userId: null,
        currentRoundTripCount: 3,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ChatAccessError);
      assert.equal(error.code, 'ANON_CHAT_LIMIT_REACHED');
      return true;
    },
  );

  const freeAllowed = await service.assertChatAllowed({
    userId: 'free-user',
    currentRoundTripCount: 6,
  });
  assert.deepEqual(freeAllowed, {
    tier: 'free',
    maxRoundTrips: 7,
  });

  await assert.rejects(
    () =>
      service.assertChatAllowed({
        userId: 'free-user',
        currentRoundTripCount: 7,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ChatAccessError);
      assert.equal(error.code, 'FREE_CHAT_LIMIT_REACHED');
      return true;
    },
  );

  const paidAllowed = await service.assertChatAllowed({
    userId: 'paid-user',
    currentRoundTripCount: 999,
  });
  assert.deepEqual(paidAllowed, {
    tier: 'paid',
    maxRoundTrips: null,
  });

  for (const [key, value] of previousEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  console.log('chat access service tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
