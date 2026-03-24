// 本地存储工具
import { STORAGE_KEYS } from './config';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'video';
  mediaUrl?: string;
}

// 保存选择的角色
export function saveSelectedCharacter(characterId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SELECTED_CHARACTER, characterId);
}

// 获取选择的角色
export function getSelectedCharacter(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.SELECTED_CHARACTER);
}

// 保存聊天历史
export function saveChatHistory(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  // 只保留最近100条消息
  const limitedMessages = messages.slice(-100);
  localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(limitedMessages));
}

// 获取聊天历史
export function getChatHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
  return data ? JSON.parse(data) : [];
}

// 清除所有数据
export function clearAllData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.SELECTED_CHARACTER);
  localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
}
