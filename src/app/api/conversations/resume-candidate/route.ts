import { NextResponse } from 'next/server';

import { getAuthenticatedSession } from '@/server/auth/request-auth';
import { getConversationService } from '@/server/conversations/default-conversation-service';
import { createConversationRouteHandlers } from '@/server/conversations/route-handlers';

export const runtime = 'nodejs';

async function buildHandlers(request: Request) {
  const session = await getAuthenticatedSession(request);

  if (!session) {
    return null;
  }

  return createConversationRouteHandlers({
    async getCurrentUser() {
      return session.user;
    },
    conversationService: getConversationService(),
  });
}

export async function GET(request: Request) {
  const handlers = await buildHandlers(request);

  if (!handlers) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  return handlers.resumeCandidate();
}
