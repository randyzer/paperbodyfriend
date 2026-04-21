import { NextResponse } from 'next/server';

import { createAuthRouteHandlers } from '@/server/auth/route-handlers';
import { getAuthService } from '@/server/auth/default-auth-service';
import { getServerEnv } from '@/server/env';

export const runtime = 'nodejs';

type RegisterRouteDeps = {
  authHandlers: {
    register(request: Request): Promise<Response>;
  };
  verifyTurnstile(input: { token: string }): Promise<boolean>;
};

function readRegisterPayload(body: unknown) {
  if (!body || typeof body !== 'object') {
    return null;
  }

  return body as Record<string, unknown>;
}

export function createRegisterRoute(deps: RegisterRouteDeps) {
  return async function register(request: Request) {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: '请求体格式不正确，请刷新后重试。' },
        { status: 400 },
      );
    }

    const payload = readRegisterPayload(body);
    if (!payload) {
      return NextResponse.json(
        { error: '注册信息不完整，请检查后重试。' },
        { status: 400 },
      );
    }

    const turnstileToken =
      typeof payload.turnstileToken === 'string' ? payload.turnstileToken : '';
    if (!turnstileToken) {
      return NextResponse.json(
        { error: '请先完成人机验证。' },
        { status: 400 },
      );
    }

    let verified = false;
    try {
      verified = await deps.verifyTurnstile({ token: turnstileToken });
    } catch {
      return NextResponse.json(
        { error: '人机验证服务暂时不可用，请稍后重试。' },
        { status: 503 },
      );
    }

    if (!verified) {
      return NextResponse.json(
        { error: '人机验证失败，请重试' },
        { status: 403 },
      );
    }

    const { turnstileToken: _ignored, ...registrationData } = payload;
    const forwardedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(registrationData),
    });

    return deps.authHandlers.register(forwardedRequest);
  };
}

async function verifyTurnstileToken(input: { token: string }) {
  const env = getServerEnv();
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new Error('TURNSTILE_SECRET_KEY is missing');
  }

  const verifyResponse = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: input.token,
      }),
    },
  );

  const verifyResult = (await verifyResponse.json()) as { success?: boolean };
  return Boolean(verifyResult.success);
}

export async function POST(request: Request) {
  return createRegisterRoute({
    authHandlers: createAuthRouteHandlers({
      authService: await getAuthService(),
    }),
    verifyTurnstile: verifyTurnstileToken,
  })(request);
}
