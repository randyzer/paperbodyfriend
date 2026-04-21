import { createAuthRouteHandlers } from '@/server/auth/route-handlers';
import { getAuthService } from '@/server/auth/default-auth-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return createAuthRouteHandlers({ authService: await getAuthService() }).session(
    request,
  );
}
