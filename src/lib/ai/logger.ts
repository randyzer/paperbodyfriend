import { AiProviderName } from './types';

type AiLogLevel = 'info' | 'warn' | 'error';

interface AiLogPayload {
  event: 'request_start' | 'request_end' | 'request_error' | 'request_retry';
  capability: string;
  provider: AiProviderName;
  model?: string;
  durationMs?: number;
  statusCode?: number;
  requestId?: string;
  errorCode?: string;
  summary?: string;
  attempt?: number;
  maxAttempts?: number;
}

export function logAiEvent(level: AiLogLevel, payload: AiLogPayload) {
  const line = `[ai] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    ...payload,
  })}`;

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}
