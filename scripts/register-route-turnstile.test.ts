import assert from 'node:assert/strict';

async function main() {
  const { createRegisterRoute } = await import(
    '../src/app/api/auth/register/route'
  );

  let forwardedBody: unknown = null;
  let verifyCalls = 0;

  const registerRoute = createRegisterRoute({
    authHandlers: {
      async register(request) {
        forwardedBody = await request.json();
        return Response.json({ ok: true }, { status: 201 });
      },
    },
    async verifyTurnstile({ token }) {
      verifyCalls += 1;
      return token === 'good-token';
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
  assert.deepEqual(await successResponse.json(), { ok: true });
  assert.equal(verifyCalls, 2);
  assert.deepEqual(forwardedBody, {
    email: 'user@example.com',
    password: 'TestPass!123',
    displayName: 'Randy',
  });

  console.log('register route turnstile test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
