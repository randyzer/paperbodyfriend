import assert from 'node:assert/strict';

async function main() {
  const { createDailyEmailCronRoute } = await import(
    '../src/app/api/cron/daily-email/route'
  );

  let sendCalls = 0;
  const capturedErrors: Array<{ message: string; error: unknown }> = [];

  const route = createDailyEmailCronRoute({
    async sendDailyLoveLetterToAll() {
      sendCalls += 1;
    },
    getCronSecret() {
      return 'cron-secret';
    },
    getCurrentTime() {
      return '2026-04-22T00:00:00.000Z';
    },
    logError(message, error) {
      capturedErrors.push({ message, error });
    },
  });

  const unauthorizedResponse = await route(
    new Request('http://localhost/api/cron/daily-email', {
      method: 'GET',
      headers: {
        authorization: 'Bearer wrong-secret',
      },
    }),
  );

  assert.equal(unauthorizedResponse.status, 401);
  assert.deepEqual(await unauthorizedResponse.json(), {
    error: '未授权访问',
  });
  assert.equal(sendCalls, 0);

  const successResponse = await route(
    new Request('http://localhost/api/cron/daily-email', {
      method: 'GET',
      headers: {
        authorization: 'Bearer cron-secret',
      },
    }),
  );

  assert.equal(successResponse.status, 200);
  assert.deepEqual(await successResponse.json(), {
    success: true,
    message: '每日情话发送完成',
    time: '2026-04-22T00:00:00.000Z',
  });
  assert.equal(sendCalls, 1);

  const failingRoute = createDailyEmailCronRoute({
    async sendDailyLoveLetterToAll() {
      throw new Error('send failed');
    },
    getCronSecret() {
      return 'cron-secret';
    },
    getCurrentTime() {
      return '2026-04-22T00:00:00.000Z';
    },
    logError(message, error) {
      capturedErrors.push({ message, error });
    },
  });

  const failedResponse = await failingRoute(
    new Request('http://localhost/api/cron/daily-email', {
      method: 'GET',
      headers: {
        authorization: 'Bearer cron-secret',
      },
    }),
  );

  assert.equal(failedResponse.status, 500);
  assert.deepEqual(await failedResponse.json(), {
    error: '发送失败',
  });

  const missingSecretRoute = createDailyEmailCronRoute({
    async sendDailyLoveLetterToAll() {
      throw new Error('should not run');
    },
    getCronSecret() {
      return null;
    },
    getCurrentTime() {
      return '2026-04-22T00:00:00.000Z';
    },
    logError(message, error) {
      capturedErrors.push({ message, error });
    },
  });

  const missingSecretResponse = await missingSecretRoute(
    new Request('http://localhost/api/cron/daily-email', {
      method: 'GET',
    }),
  );

  assert.equal(missingSecretResponse.status, 500);
  assert.deepEqual(await missingSecretResponse.json(), {
    error: '服务端配置缺失',
  });

  assert.equal(capturedErrors.length, 2);
  assert.match(capturedErrors[0]?.message ?? '', /每日情话发送失败/);
  assert.match(String(capturedErrors[0]?.error), /send failed/);
  assert.match(capturedErrors[1]?.message ?? '', /每日情话发送失败/);
  assert.match(String(capturedErrors[1]?.error), /CRON_SECRET is missing/);

  console.log('daily email cron route test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
