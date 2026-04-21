import assert from 'node:assert/strict';

async function main() {
  const { createAuthRouteHandlers } = await import(
    '../src/server/auth/route-handlers'
  );

  const authHandlers = createAuthRouteHandlers({
    authService: {
      async register(input) {
        return {
          user: {
            id: 'user_1',
            email: input.email.trim().toLowerCase(),
            displayName: input.displayName ?? null,
            avatarUrl: 'https://cdn.example.com/avatar-register.png',
          },
          sessionToken: 'register-token',
          expiresAt: new Date('2026-05-20T08:00:00.000Z'),
        };
      },
      async login(input) {
        return {
          user: {
            id: 'user_1',
            email: input.email.trim().toLowerCase(),
            displayName: 'Randy',
            avatarUrl: 'https://cdn.example.com/avatar-login.png',
          },
          sessionToken: 'login-token',
          expiresAt: new Date('2026-05-20T08:00:00.000Z'),
        };
      },
      async logout(_token: string) {},
      async getSessionByToken(token: string) {
        if (token !== 'live-token') {
          return null;
        }

        return {
          user: {
            id: 'user_1',
            email: 'user@example.com',
            displayName: 'Randy',
            avatarUrl: 'https://cdn.example.com/avatar-session.png',
          },
          session: {
            id: 'session_1',
            expiresAt: new Date('2026-05-20T08:00:00.000Z'),
          },
        };
      },
    },
  });

  const registerResponse = await authHandlers.register(
    new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ' USER@example.com ',
        password: 'TestPass!123',
        displayName: 'Randy',
        turnstileToken: 'turnstile-token',
      }),
    }),
  );

  assert.equal(registerResponse.status, 201);
  assert.match(
    registerResponse.headers.get('set-cookie') ?? '',
    /paperboyfriend_session=register-token/,
  );
  assert.deepEqual(await registerResponse.json(), {
    user: {
      id: 'user_1',
      email: 'user@example.com',
      displayName: 'Randy',
      avatarUrl: 'https://cdn.example.com/avatar-register.png',
    },
  });

  const loginResponse = await authHandlers.login(
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'USER@example.com',
        password: 'TestPass!123',
      }),
    }),
  );

  assert.equal(loginResponse.status, 200);
  assert.match(
    loginResponse.headers.get('set-cookie') ?? '',
    /paperboyfriend_session=login-token/,
  );
  assert.deepEqual(await loginResponse.json(), {
    user: {
      id: 'user_1',
      email: 'user@example.com',
      displayName: 'Randy',
      avatarUrl: 'https://cdn.example.com/avatar-login.png',
    },
  });

  const sessionResponse = await authHandlers.session(
    new Request('http://localhost/api/auth/session', {
      method: 'GET',
      headers: {
        cookie: 'paperboyfriend_session=live-token',
      },
    }),
  );

  assert.equal(sessionResponse.status, 200);
  assert.deepEqual(await sessionResponse.json(), {
    authenticated: true,
    user: {
      id: 'user_1',
      email: 'user@example.com',
      displayName: 'Randy',
      avatarUrl: 'https://cdn.example.com/avatar-session.png',
    },
  });

  const logoutResponse = await authHandlers.logout(
    new Request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: 'paperboyfriend_session=live-token',
      },
    }),
  );

  assert.equal(logoutResponse.status, 200);
  assert.match(
    logoutResponse.headers.get('set-cookie') ?? '',
    /paperboyfriend_session=;/,
  );

  console.log('auth route handlers test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
