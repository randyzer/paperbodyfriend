export type ChatAccessErrorCode =
  | 'ANON_CHAT_COOKIE_INVALID'
  | 'ANON_CHAT_LIMIT_REACHED'
  | 'FREE_CHAT_LIMIT_REACHED';

const CHAT_ACCESS_ERROR_STATUS: Record<ChatAccessErrorCode, number> = {
  ANON_CHAT_COOKIE_INVALID: 403,
  ANON_CHAT_LIMIT_REACHED: 403,
  FREE_CHAT_LIMIT_REACHED: 403,
};

const CHAT_ACCESS_ERROR_MESSAGE: Record<ChatAccessErrorCode, string> = {
  ANON_CHAT_COOKIE_INVALID: 'Anonymous chat cookie is invalid',
  ANON_CHAT_LIMIT_REACHED: 'Anonymous chat limit reached',
  FREE_CHAT_LIMIT_REACHED: 'Free chat limit reached',
};

const CHAT_ACCESS_USER_MESSAGE: Record<ChatAccessErrorCode, string> = {
  ANON_CHAT_COOKIE_INVALID: '匿名试玩状态无效，请清空浏览器 Cookie 后重试。',
  ANON_CHAT_LIMIT_REACHED: '匿名用户可用对话次数已达上限，请登录后继续。',
  FREE_CHAT_LIMIT_REACHED: '免费用户可用对话次数已达上限，请订阅后继续。',
};

export class ChatAccessError extends Error {
  code: ChatAccessErrorCode;
  statusCode: number;
  userMessage: string;

  constructor(code: ChatAccessErrorCode) {
    super(CHAT_ACCESS_ERROR_MESSAGE[code]);
    this.name = 'ChatAccessError';
    this.code = code;
    this.statusCode = CHAT_ACCESS_ERROR_STATUS[code];
    this.userMessage = CHAT_ACCESS_USER_MESSAGE[code];
  }
}
