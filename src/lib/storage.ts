// 本地存储工具
import { STORAGE_KEYS } from './config';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'video';
  mediaUrl?: string;
  videoRequestId?: string;
  videoStatus?: 'pending' | 'completed' | 'failed';
  pendingCaption?: string;
  mediaKind?: 'dance' | 'workout';
}

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined';
}

function isValidUserId(userId: string): boolean {
  return userId.trim() !== '' && userId !== 'undefined' && userId !== 'null';
}

export function buildUserStorageKey(baseKey: string, userId: string): string {
  return `${baseKey}:${userId}`;
}

function getUserStorageKey(baseKey: string, userId: string): string | null {
  if (!isValidUserId(userId)) return null;
  return buildUserStorageKey(baseKey, userId);
}

function saveItem(key: string, value: string): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(key, value);
}

function getItem(key: string): string | null {
  if (!hasLocalStorage()) return null;
  return localStorage.getItem(key);
}

function removeItem(key: string): void {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(key);
}

export function saveSelectedCharacterForUser(
  userId: string,
  characterId: string,
): void {
  const key = getUserStorageKey(STORAGE_KEYS.SELECTED_CHARACTER, userId);
  if (!key) return;
  saveItem(key, characterId);
}

export function getSelectedCharacterForUser(userId: string): string | null {
  const key = getUserStorageKey(STORAGE_KEYS.SELECTED_CHARACTER, userId);
  return key ? getItem(key) : null;
}

export function saveConversationIdForUser(
  userId: string,
  conversationId: string,
): void {
  const key = getUserStorageKey(STORAGE_KEYS.CONVERSATION_ID, userId);
  if (!key) return;
  saveItem(key, conversationId);
}

export function getConversationIdForUser(userId: string): string | null {
  const key = getUserStorageKey(STORAGE_KEYS.CONVERSATION_ID, userId);
  return key ? getItem(key) : null;
}

export function markResumeSkipForUser(userId: string): void {
  const key = getUserStorageKey(STORAGE_KEYS.RESUME_SKIP, userId);
  if (!key) return;
  saveItem(key, '1');
}

export function shouldSkipResumeForUser(userId: string): boolean {
  const key = getUserStorageKey(STORAGE_KEYS.RESUME_SKIP, userId);
  if (!key) return false;
  return getItem(key) === '1';
}

export function clearResumeSkipForUser(userId: string): void {
  const key = getUserStorageKey(STORAGE_KEYS.RESUME_SKIP, userId);
  if (!key) return;
  removeItem(key);
}

export function saveChatHistoryForUser(
  userId: string,
  messages: ChatMessage[],
): void {
  const key = getUserStorageKey(STORAGE_KEYS.CHAT_HISTORY, userId);
  if (!key) return;
  const limitedMessages = messages.slice(-100);
  saveItem(key, JSON.stringify(limitedMessages));
}

export function getChatHistoryForUser(userId: string): ChatMessage[] {
  const key = getUserStorageKey(STORAGE_KEYS.CHAT_HISTORY, userId);
  if (!key) return [];

  const data = getItem(key);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function clearConversationStateForUser(userId: string): void {
  const selectedCharacterKey = getUserStorageKey(STORAGE_KEYS.SELECTED_CHARACTER, userId);
  const conversationIdKey = getUserStorageKey(STORAGE_KEYS.CONVERSATION_ID, userId);
  const chatHistoryKey = getUserStorageKey(STORAGE_KEYS.CHAT_HISTORY, userId);

  if (!selectedCharacterKey || !conversationIdKey || !chatHistoryKey) return;

  removeItem(selectedCharacterKey);
  removeItem(conversationIdKey);
  removeItem(chatHistoryKey);
}

export function migrateLegacyStorageToUser(userId: string): void {
  if (!hasLocalStorage()) return;
  if (!isValidUserId(userId)) return;

  const scopedCharacterKey = buildUserStorageKey(
    STORAGE_KEYS.SELECTED_CHARACTER,
    userId,
  );
  const scopedConversationIdKey = buildUserStorageKey(
    STORAGE_KEYS.CONVERSATION_ID,
    userId,
  );
  const scopedChatHistoryKey = buildUserStorageKey(STORAGE_KEYS.CHAT_HISTORY, userId);

  const legacyCharacter = localStorage.getItem(STORAGE_KEYS.SELECTED_CHARACTER);
  const legacyConversationId = localStorage.getItem(STORAGE_KEYS.CONVERSATION_ID);
  const legacyChatHistory = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
  let migrated = false;

  if (!localStorage.getItem(scopedCharacterKey) && legacyCharacter) {
    localStorage.setItem(scopedCharacterKey, legacyCharacter);
    migrated = true;
  }

  if (!localStorage.getItem(scopedConversationIdKey) && legacyConversationId) {
    localStorage.setItem(scopedConversationIdKey, legacyConversationId);
    migrated = true;
  }

  if (!localStorage.getItem(scopedChatHistoryKey) && legacyChatHistory) {
    localStorage.setItem(scopedChatHistoryKey, legacyChatHistory);
    migrated = true;
  }

  if (migrated) {
    localStorage.removeItem(STORAGE_KEYS.SELECTED_CHARACTER);
    localStorage.removeItem(STORAGE_KEYS.CONVERSATION_ID);
    localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
  }
}

// 保存选择的角色
export function saveSelectedCharacter(characterId: string): void {
  saveItem(STORAGE_KEYS.SELECTED_CHARACTER, characterId);
}

// 获取选择的角色
export function getSelectedCharacter(): string | null {
  return getItem(STORAGE_KEYS.SELECTED_CHARACTER);
}

// 保存聊天历史
export function saveChatHistory(messages: ChatMessage[]): void {
  const limitedMessages = messages.slice(-100);
  saveItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(limitedMessages));
}

// 获取聊天历史
export function getChatHistory(): ChatMessage[] {
  const data = getItem(STORAGE_KEYS.CHAT_HISTORY);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// 清除所有数据
export function clearAllData(): void {
  removeItem(STORAGE_KEYS.SELECTED_CHARACTER);
  removeItem(STORAGE_KEYS.CHAT_HISTORY);
  removeItem(STORAGE_KEYS.CONVERSATION_ID);
}
