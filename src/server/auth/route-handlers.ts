import { NextResponse } from 'next/server';

import { AuthError } from './auth-service';
import {
  buildExpiredSessionCookieOptions,
  buildSessionCookieOptions,
  getSessionCookieName,
} from './session-cookie';

type AuthRouteDeps = {
  authService: {
    register(input: {
      email: string;
      password: string;
      displayName?: string | null;
      userAgent?: string | null;
      ipAddress?: string | null;
    }): Promise<{
      user: { id: string; email: string; displayName: string | null };
      sessionToken: string;
      expiresAt: Date;
    }>;
    login(input: {
      email: string;
      password: string;
      userAgent?: string | null;
      ipAddress?: string | null;
    }): Promise<{
      user: { id: string; email: string; displayName: string | null };
      sessionToken: string;
      expiresAt: Date;
    }>;
    logout(token: string | null | undefined): Promise<void>;
    getSessionByToken(token: string | null | undefined): Promise<{
      user: { id: string; email: string; displayName: string | null };
      session: { id: string; expiresAt: Date };
    } | null>;
  };
};

function readCookieValue(request: Request, cookieName: string): string | null {
  const rawCookie = request.headers.get('cookie');
  if (!rawCookie) {
    return null;
  }

  const cookies = rawCookie.split(';').map(part => part.trim());
  const entry = cookies.find(part => part.startsWith(`${cookieName}=`));

  return entry ? decodeURIComponent(entry.slice(cookieName.length + 1)) : null;
}

function getClientIpAddress(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  return request.headers.get('x-real-ip');
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AuthError(
      'BAD_REQUEST',
      'Invalid JSON body',
      400,
      '请求体格式不正确，请刷新后重试。',
    );
  }
}

function validateRegisterBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    throw new AuthError(
      'BAD_REQUEST',
      'Register payload missing',
      400,
      '注册信息不完整，请检查后重试。',
    );
  }

  const payload = body as Record<string, unknown>;
  const email = typeof payload.email === 'string' ? payload.email : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const displayName =
    typeof payload.displayName === 'string' ? payload.displayName : null;

  return { email, password, displayName };
}

function validateLoginBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    throw new AuthError(
      'BAD_REQUEST',
      'Login payload missing',
      400,
      '登录信息不完整，请检查后重试。',
    );
  }

  const payload = body as Record<string, unknown>;
  const email = typeof payload.email === 'string' ? payload.email : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  return { email, password };
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: error.userMessage,
        code: error.code,
      },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    {
      error: '认证服务暂时不可用，请稍后重试。',
      code: 'UNKNOWN',
    },
    { status: 500 },
  );
}

export function createAuthRouteHandlers(deps: AuthRouteDeps) {
  const cookieName = getSessionCookieName();

  return {
    async register(request: Request) {
      try {
        const body = validateRegisterBody(await readJsonBody(request));
        const result = await deps.authService.register({
          ...body,
          userAgent: request.headers.get('user-agent'),
          ipAddress: getClientIpAddress(request),
        });

        const response = NextResponse.json(
          {
            user: result.user,
          },
          { status: 201 },
        );

        response.cookies.set(
          cookieName,
          result.sessionToken,
          buildSessionCookieOptions(result.expiresAt),
        );

        return response;
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    async login(request: Request) {
      try {
        const body = validateLoginBody(await readJsonBody(request));
        const result = await deps.authService.login({
          ...body,
          userAgent: request.headers.get('user-agent'),
          ipAddress: getClientIpAddress(request),
        });

        const response = NextResponse.json({
          user: result.user,
        });

        response.cookies.set(
          cookieName,
          result.sessionToken,
          buildSessionCookieOptions(result.expiresAt),
        );

        return response;
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    async logout(request: Request) {
      try {
        await deps.authService.logout(readCookieValue(request, cookieName));

        const response = NextResponse.json({
          success: true,
        });
        response.cookies.set(
          cookieName,
          '',
          buildExpiredSessionCookieOptions(),
        );
        return response;
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    async session(request: Request) {
      try {
        const session = await deps.authService.getSessionByToken(
          readCookieValue(request, cookieName),
        );

        if (!session) {
          return NextResponse.json({
            authenticated: false,
            user: null,
          });
        }

        return NextResponse.json({
          authenticated: true,
          user: session.user,
        });
      } catch (error) {
        return toErrorResponse(error);
      }
    },
  };
}
