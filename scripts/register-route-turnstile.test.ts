import assert from 'node:assert/strict';

async function main() {
  const { createRegisterRoute } = await import(
    '../src/app/api/auth/register/route'
  );

  let forwardedBody: unknown = null;
  let verifyCalls = 0;
  const sentEmails: Array<{ email: string; name: string }> = [];

  const registerRoute = createRegisterRoute({
    authHandlers: {
      async register(request) {
        forwardedBody = await request.json();
        return Response.json(
          {
            user: {
              email: 'user@example.com',
              displayName: 'Randy',
            },
          },
          { status: 201 },
        );
      },
    },
    async verifyTurnstile({ token }) {
      verifyCalls += 1;
      return token === 'good-token';
    },
    async sendWelcomeEmail(email, name) {
      sentEmails.push({ email, name });
    },
  });

  const missingTokenResponse = await registerRoute(
    new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'TestPass!123',
      }),
    }),
  );

  assert.equal(missingTokenResponse.status, 400);
  assert.deepEqual(await missingTokenResponse.json(), {
    error: '请先完成人机验证。',
  });

  const rejectedResponse = await registerRoute(
    new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'TestPass!123',
        displayName: 'Randy',
        turnstileToken: 'bad-token',
      }),
    }),
  );

  assert.equal(rejectedResponse.status, 403);
  assert.deepEqual(await rejectedResponse.json(), {
    error: '人机验证失败，请重试',
  });

  const successResponse = await registerRoute(
    new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'TestPass!123',
        displayName: 'Randy',
        turnstileToken: 'good-token',
      }),
    }),
  );

  assert.equal(successResponse.status, 201);
  assert.deepEqual(await successResponse.json(), {
    user: {
      email: 'user@example.com',
      displayName: 'Randy',
    },
  });
  assert.equal(verifyCalls, 2);
  assert.deepEqual(forwardedBody, {
    email: 'user@example.com',
    password: 'TestPass!123',
    displayName: 'Randy',
  });
  assert.deepEqual(sentEmails, [
    {
      email: 'user@example.com',
      name: 'Randy',
    },
  ]);

  const capturedErrors: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args);
  };

  try {
    const failingMailRoute = createRegisterRoute({
      authHandlers: {
        async register() {
          return Response.json(
            {
              user: {
                email: 'fallback@example.com',
                displayName: null,
              },
            },
            { status: 201 },
          );
        },
      },
      async verifyTurnstile() {
        return true;
      },
      async sendWelcomeEmail() {
        throw new Error('smtp unavailable');
      },
    });

    const emailFailureResponse = await failingMailRoute(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'fallback@example.com',
          password: 'TestPass!123',
          turnstileToken: 'good-token',
        }),
      }),
    );

    assert.equal(emailFailureResponse.status, 201);
    assert.deepEqual(await emailFailureResponse.json(), {
      user: {
        email: 'fallback@example.com',
        displayName: null,
      },
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(capturedErrors.length, 1);
  assert.match(String(capturedErrors[0]?.[0] ?? ''), /欢迎邮件发送失败/);

  console.log('register route turnstile test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
