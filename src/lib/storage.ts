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

export interface UserInfo {
  gender?: string;
  age?: number;
  birthday?: string;
  birthPlace?: string;
  city?: string;
  job?: string;
  personality?: string;
  health?: string;
  foodPreference?: string;
  sports?: string;
  hobbies?: string;
  sleepTime?: string;
}

// 保存用户信息
export function saveUserInfo(userInfo: UserInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
}

// 获取用户信息
export function getUserInfo(): UserInfo | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.USER_INFO);
  return data ? JSON.parse(data) : null;
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

// 导出聊天记录
export function exportChatHistory(messages: ChatMessage[], characterName: string): void {
  if (typeof window === 'undefined') return;
  
  let content = `与${characterName}的聊天记录\n`;
  content += `导出时间：${new Date().toLocaleString('zh-CN')}\n`;
  content += '='.repeat(50) + '\n\n';
  
  messages.forEach(msg => {
    const time = new Date(msg.timestamp).toLocaleString('zh-CN');
    const sender = msg.role === 'user' ? '我' : characterName;
    content += `[${time}] ${sender}：${msg.content}\n\n`;
  });
  
  // 创建下载
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `聊天记录_${characterName}_${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

// 清除所有数据
export function clearAllData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
  localStorage.removeItem(STORAGE_KEYS.SELECTED_CHARACTER);
  localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
}
