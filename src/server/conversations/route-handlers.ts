import { NextResponse } from 'next/server';

import type { ConversationMessageInput } from './conversation-service';

type ConversationRouteDeps = {
  getCurrentUser(): Promise<{ id: string }>;
  conversationService: {
    getResumeCandidate(userId: string): Promise<{
      conversationId: string;
      characterId: string;
      lastMessagePreview: string | null;
      lastMessageAt: Date;
    } | null>;
    createConversation(input: {
      userId: string;
      characterId: string;
    }): Promise<{ id: string; characterId: string }>;
    getConversationDetail(input: {
      userId: string;
      conversationId: string;
    }): Promise<unknown>;
    syncConversationMessages(input: {
      userId: string;
      conversationId: string;
      characterId: string;
      messages: ConversationMessageInput[];
    }): Promise<{ conversationId: string; persistedCount: number }>;
  };
};

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

function isConversationMessageInput(
  value: unknown,
): value is ConversationMessageInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Record<string, unknown>;
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string' &&
    typeof message.timestamp === 'number' &&
    Number.isFinite(message.timestamp)
  );
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export function createConversationRouteHandlers(deps: ConversationRouteDeps) {
  return {
    async resumeCandidate() {
      const user = await deps.getCurrentUser();
      const candidate = await deps.conversationService.getResumeCandidate(user.id);

      return NextResponse.json({
        hasResumeCandidate: Boolean(candidate),
        source: candidate ? 'database' : null,
        ...(candidate ?? {}),
      });
    },

    async createConversation(request: Request) {
      try {
        const body = await readJsonBody(request);
        const characterId =
          body && typeof body === 'object' && typeof body.characterId === 'string'
            ? body.characterId
            : '';

        if (!characterId) {
          return badRequest('characterId is required');
        }

        const user = await deps.getCurrentUser();
        const conversation = await deps.conversationService.createConversation({
          userId: user.id,
          characterId,
        });

        return NextResponse.json(
          {
            conversationId: conversation.id,
            characterId: conversation.characterId,
          },
          { status: 201 },
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'Invalid JSON body') {
          return badRequest(error.message);
        }

        throw error;
      }
    },

    async getConversation(_request: Request, context: RouteContext) {
      const user = await deps.getCurrentUser();
      const { conversationId } = await context.params;
      const detail = await deps.conversationService.getConversationDetail({
        userId: user.id,
        conversationId,
      });

      if (!detail) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 },
        );
      }

      return NextResponse.json(detail);
    },

    async syncMessages(request: Request, context: RouteContext) {
      try {
        const body = await readJsonBody(request);
        const characterId =
          body && typeof body === 'object' && typeof body.characterId === 'string'
            ? body.characterId
            : '';
        const messages =
          body &&
          typeof body === 'object' &&
          Array.isArray((body as { messages?: unknown[] }).messages)
            ? ((body as { messages: unknown[] }).messages ?? [])
            : null;

        if (!characterId || !messages) {
          return badRequest('characterId and messages are required');
        }

        if (!messages.every(isConversationMessageInput)) {
          return badRequest('messages must be an array of valid conversation messages');
        }

        const user = await deps.getCurrentUser();
        const { conversationId } = await context.params;
        const result = await deps.conversationService.syncConversationMessages({
          userId: user.id,
          conversationId,
          characterId,
          messages,
        });

        return NextResponse.json({
          success: true,
          conversationId: result.conversationId,
          persistedCount: result.persistedCount,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Invalid JSON body') {
            return badRequest(error.message);
          }

          if (error.message === 'Conversation not found') {
            return NextResponse.json({ error: error.message }, { status: 404 });
          }
        }

        throw error;
      }
    },
  };
}
