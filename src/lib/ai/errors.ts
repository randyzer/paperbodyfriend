import { AiProviderName } from './types';

export type BusinessErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'UNKNOWN';

interface ProviderRequestErrorOptions {
  provider: AiProviderName;
  message: string;
  statusCode?: number;
  details?: unknown;
}

interface BusinessErrorOptions {
  code: BusinessErrorCode;
  message: string;
  userMessage: string;
  statusCode: number;
  retryable: boolean;
  provider?: AiProviderName;
  details?: unknown;
}

export class ProviderRequestError extends Error {
  provider: AiProviderName;
  statusCode?: number;
  details?: unknown;

  constructor(options: ProviderRequestErrorOptions) {
    super(options.message);
    this.name = 'ProviderRequestError';
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.details = options.details;
  }
}

export class BusinessError extends Error {
  code: BusinessErrorCode;
  userMessage: string;
  statusCode: number;
  retryable: boolean;
  provider?: AiProviderName;
  details?: unknown;

  constructor(options: BusinessErrorOptions) {
    super(options.message);
    this.name = 'BusinessError';
    this.code = options.code;
    this.userMessage = options.userMessage;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable;
    this.provider = options.provider;
    this.details = options.details;
  }
}

function buildBusinessErrorFromStatus(
  provider: AiProviderName | undefined,
  statusCode: number,
  message: string,
  details?: unknown,
): BusinessError {
  if (statusCode === 400) {
    return new BusinessError({
      code: 'BAD_REQUEST',
      message,
      userMessage: 'AI 请求参数有误，请稍后重试。',
      statusCode,
      retryable: false,
      provider,
      details,
    });
  }

  if (statusCode === 401) {
    return new BusinessError({
      code: 'UNAUTHORIZED',
      message,
      userMessage: 'AI 服务鉴权失败，请检查服务端密钥配置。',
      statusCode,
      retryable: false,
      provider,
      details,
    });
  }

  if (statusCode === 403) {
    return new BusinessError({
      code: 'FORBIDDEN',
      message,
      userMessage: 'AI 服务无权访问当前资源，请检查账号权限。',
      statusCode,
      retryable: false,
      provider,
      details,
    });
  }

  if (statusCode === 429) {
    return new BusinessError({
      code: 'RATE_LIMITED',
      message,
      userMessage: 'AI 请求过于频繁，请稍后再试。',
      statusCode,
      retryable: true,
      provider,
      details,
    });
  }

  if (statusCode === 408 || statusCode === 504) {
    return new BusinessError({
      code: 'TIMEOUT',
      message,
      userMessage: 'AI 服务响应超时，请稍后重试。',
      statusCode: 504,
      retryable: true,
      provider,
      details,
    });
  }

  if (statusCode >= 500) {
    return new BusinessError({
      code: 'UPSTREAM_ERROR',
      message,
      userMessage: 'AI 服务暂时不可用，请稍后重试。',
      statusCode: 502,
      retryable: true,
      provider,
      details,
    });
  }

  return new BusinessError({
    code: 'UNKNOWN',
    message,
    userMessage: 'AI 服务调用失败，请稍后重试。',
    statusCode: 500,
    retryable: true,
    provider,
    details,
  });
}

export function classifyProviderFailure(error: unknown): BusinessError {
  if (error instanceof BusinessError) {
    return error;
  }

  if (error instanceof ProviderRequestError) {
    return buildBusinessErrorFromStatus(
      error.provider,
      error.statusCode ?? 500,
      error.message,
      error.details,
    );
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return buildBusinessErrorFromStatus(undefined, 504, error.message, error);
  }

  if (error instanceof Error && /timeout/i.test(error.message)) {
    return buildBusinessErrorFromStatus(undefined, 504, error.message, error);
  }

  if (error instanceof Error) {
    return buildBusinessErrorFromStatus(undefined, 500, error.message, error);
  }

  return buildBusinessErrorFromStatus(undefined, 500, 'Unknown AI error', error);
}

export function getErrorSummary(error: unknown): string {
  if (error instanceof BusinessError) {
    return `${error.code}:${error.message}`;
  }

  if (error instanceof ProviderRequestError) {
    return `${error.provider}:${error.statusCode ?? 'unknown'}:${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'unknown error';
}

export function toRouteError(
  error: unknown,
  fallbackMessage: string,
): { status: number; body: { error: string; code: BusinessErrorCode } } {
  const classified = classifyProviderFailure(error);

  return {
    status: classified.statusCode,
    body: {
      error: classified.userMessage || fallbackMessage,
      code: classified.code,
    },
  };
}
