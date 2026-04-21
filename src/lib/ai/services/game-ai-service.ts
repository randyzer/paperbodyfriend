import { getAiConfig } from '@/lib/ai/config';
import { getErrorSummary, ProviderRequestError } from '@/lib/ai/errors';
import { logAiEvent } from '@/lib/ai/logger';
import { getTextProvider } from '@/lib/ai/provider-factory';
import { ProviderMessage, TextGenerationResult } from '@/lib/ai/types';

interface GenerateGameTextParams {
  capability: 'game_start' | 'game_chat';
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt: string;
}

export async function generateGameText(
  input: GenerateGameTextParams,
): Promise<TextGenerationResult> {
  const config = getAiConfig();
  const provider = getTextProvider();
  const startedAt = Date.now();
  const providerMessages: ProviderMessage[] = [
    { role: 'system', content: input.systemPrompt },
    ...input.messages,
  ];

  logAiEvent('info', {
    event: 'request_start',
    capability: input.capability,
    provider: provider.name,
    model: config.arkChatModel,
  });

  try {
    const result = await provider.generateText({
      messages: providerMessages,
      temperature: 0.8,
      maxOutputTokens: config.chatMaxOutputTokens,
      timeoutMs: config.chatTimeoutMs,
    });

    logAiEvent('info', {
      event: 'request_end',
      capability: input.capability,
      provider: result.provider,
      model: result.model,
      durationMs: Date.now() - startedAt,
      statusCode: result.statusCode,
      requestId: result.requestId,
      summary: result.text.slice(0, 120),
    });

    return result;
  } catch (error) {
    const statusCode =
      error instanceof ProviderRequestError ? error.statusCode : undefined;

    logAiEvent('error', {
      event: 'request_error',
      capability: input.capability,
      provider: provider.name,
      model: config.arkChatModel,
      durationMs: Date.now() - startedAt,
      statusCode,
      summary: getErrorSummary(error),
    });

    throw error;
  }
}
