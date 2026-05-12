import { createHmac, timingSafeEqual } from 'node:crypto';

const ANON_CHAT_COOKIE_NAME = 'paper_boyfriend_anon_rounds';
const ANON_CHAT_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const ANON_CHAT_COOKIE_VERSION = 'v1';

export type AnonChatRoundsCookieState = {
  exists: boolean;
  isTampered: boolean;
  roundCount: number;
};

function getAnonChatCookieSecret() {
  const secret =
    process.env.CHAT_ACCESS_COOKIE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error('CHAT_ACCESS_COOKIE_SECRET is missing');
  }

  return secret;
}

function normalizeConversationId(conversationId: string | null | undefined) {
  const normalized = conversationId?.trim();
  return normalized && normalized.length > 0 ? normalized : 'global';
}

function encodeConversationId(conversationId: string) {
  return Buffer.from(conversationId, 'utf8').toString('base64url');
}

function decodeConversationId(encodedConversationId: string) {
  try {
    const decoded = Buffer.from(encodedConversationId, 'base64url').toString('utf8');
    return decoded.trim().length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

function signRoundCount(roundCount: number, conversationId: string) {
  return createHmac('sha256', getAnonChatCookieSecret())
    .update(`${ANON_CHAT_COOKIE_VERSION}.${roundCount}.${conversationId}`)
    .digest('base64url');
}

function readCookieValue(rawCookieHeader: string | null) {
  if (!rawCookieHeader) {
    return null;
  }

  const cookies = rawCookieHeader.split(';').map(part => part.trim());
  const entry = cookies.find(part => part.startsWith(`${ANON_CHAT_COOKIE_NAME}=`));
  return entry ? decodeURIComponent(entry.slice(ANON_CHAT_COOKIE_NAME.length + 1)) : null;
}

function isValidSignature(expectedSignature: string, actualSignature: string) {
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(actualSignature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function getAnonChatRoundsCookieName() {
  return ANON_CHAT_COOKIE_NAME;
}

export function readAnonChatRoundsCookie(
  rawCookieHeader: string | null,
  currentConversationId?: string | null,
): AnonChatRoundsCookieState {
  const rawValue = readCookieValue(rawCookieHeader);
  if (!rawValue) {
    return {
      exists: false,
      isTampered: false,
      roundCount: 0,
    };
  }

  const [version, rawRoundCount, rawConversationId, signature] = rawValue.split('.');
  if (
    version !== ANON_CHAT_COOKIE_VERSION ||
    !rawRoundCount ||
    !rawConversationId ||
    !signature
  ) {
    return {
      exists: true,
      isTampered: true,
      roundCount: 0,
    };
  }

  const roundCount = Number.parseInt(rawRoundCount, 10);
  if (!Number.isFinite(roundCount) || roundCount < 0) {
    return {
      exists: true,
      isTampered: true,
      roundCount: 0,
    };
  }

  const conversationId = decodeConversationId(rawConversationId);
  if (!conversationId) {
    return {
      exists: true,
      isTampered: true,
      roundCount: 0,
    };
  }

  const expectedSignature = signRoundCount(roundCount, conversationId);
  if (!isValidSignature(expectedSignature, signature)) {
    return {
      exists: true,
      isTampered: true,
      roundCount: 0,
    };
  }

  const normalizedCurrentConversationId =
    currentConversationId === undefined
      ? undefined
      : normalizeConversationId(currentConversationId);

  return {
    exists: true,
    isTampered: false,
    roundCount:
      normalizedCurrentConversationId !== undefined &&
      normalizedCurrentConversationId !== conversationId
        ? 0
        : roundCount,
  };
}

export function buildAnonChatRoundsCookie(
  nextRoundCount: number,
  conversationId?: string | null,
): string {
  const normalizedConversationId = normalizeConversationId(conversationId);
  const cookieValue = [
    ANON_CHAT_COOKIE_VERSION,
    String(nextRoundCount),
    encodeConversationId(normalizedConversationId),
    signRoundCount(nextRoundCount, normalizedConversationId),
  ].join('.');

  return `${ANON_CHAT_COOKIE_NAME}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ANON_CHAT_COOKIE_MAX_AGE_SECONDS}`;
}
