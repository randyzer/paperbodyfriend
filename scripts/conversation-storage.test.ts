import assert from 'node:assert/strict';

type FakeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createFakeLocalStorage(): FakeStorage {
  const store = new Map<string, string>();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

async function main() {
  const localStorage = createFakeLocalStorage();

  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
  });

  const {
    saveSelectedCharacterForUser,
    getSelectedCharacterForUser,
    saveChatHistoryForUser,
    getChatHistoryForUser,
    saveConversationIdForUser,
    getConversationIdForUser,
    markResumeSkipForUser,
    shouldSkipResumeForUser,
    clearResumeSkipForUser,
    migrateLegacyStorageToUser,
    clearConversationStateForUser,
    saveSelectedCharacter,
    getSelectedCharacter,
    saveChatHistory,
    getChatHistory,
    clearAllData,
  } = await import('../src/lib/storage');
  const { STORAGE_KEYS } = await import('../src/lib/config');

  const oldMessage = {
    id: 'message_legacy',
    role: 'assistant' as const,
    content: 'legacy hello',
    timestamp: 1713600000000,
  };

  localStorage.setItem('ai_boyfriend_character', 'uncle');
  localStorage.setItem('ai_boyfriend_chat_history', JSON.stringify([oldMessage]));
  localStorage.setItem('ai_boyfriend_conversation_id', 'legacy_conversation');

  migrateLegacyStorageToUser('user_1');

  assert.equal(getSelectedCharacterForUser('user_1'), 'uncle');
  assert.deepEqual(getChatHistoryForUser('user_1'), [oldMessage]);
  assert.equal(getConversationIdForUser('user_1'), 'legacy_conversation');
  assert.equal(localStorage.getItem(STORAGE_KEYS.SELECTED_CHARACTER), null);
  assert.equal(localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY), null);
  assert.equal(localStorage.getItem(STORAGE_KEYS.CONVERSATION_ID), null);

  localStorage.setItem('ai_boyfriend_conversation_id:user_2', 'existing_conversation');
  migrateLegacyStorageToUser('user_2');
  assert.equal(getConversationIdForUser('user_2'), 'existing_conversation');

  saveSelectedCharacterForUser('user_3', 'sunshine');
  saveConversationIdForUser('user_3', 'existing_conversation_3');
  saveChatHistoryForUser('user_3', [
    {
      id: 'existing_message_user_3',
      role: 'assistant',
      content: 'existing scoped data',
      timestamp: 1713607200000,
    },
  ]);
  migrateLegacyStorageToUser('user_3');
  assert.equal(getSelectedCharacterForUser('user_3'), 'sunshine');
  assert.equal(getConversationIdForUser('user_3'), 'existing_conversation_3');
  assert.equal(getChatHistoryForUser('user_3')[0]?.content, 'existing scoped data');

  saveSelectedCharacterForUser('user_4', 'straight_man');
  localStorage.setItem(STORAGE_KEYS.SELECTED_CHARACTER, 'straight_man');
  localStorage.setItem(STORAGE_KEYS.CONVERSATION_ID, 'legacy_conversation_user_4');
  localStorage.setItem(
    STORAGE_KEYS.CHAT_HISTORY,
    JSON.stringify([
      {
        id: 'message_legacy_user_4',
        role: 'assistant',
        content: 'legacy migrated without overwriting scoped selection',
        timestamp: 1713608000000,
      },
    ]),
  );
  migrateLegacyStorageToUser('user_4');
  assert.equal(getSelectedCharacterForUser('user_4'), 'straight_man');
  assert.equal(getConversationIdForUser('user_4'), 'legacy_conversation_user_4');
  assert.equal(
    getChatHistoryForUser('user_4')[0]?.content,
    'legacy migrated without overwriting scoped selection',
  );
  assert.equal(localStorage.getItem(STORAGE_KEYS.SELECTED_CHARACTER), null);
  assert.equal(localStorage.getItem(STORAGE_KEYS.CONVERSATION_ID), null);
  assert.equal(localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY), null);

  saveSelectedCharacter('uncle');
  saveChatHistory([oldMessage]);
  assert.equal(getSelectedCharacter(), 'uncle');
  assert.deepEqual(getChatHistory(), [oldMessage]);

  localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, '{broken json');
  assert.deepEqual(getChatHistory(), []);

  saveSelectedCharacterForUser('user_2', 'sunshine');
  saveConversationIdForUser('user_2', 'conversation_2');
  saveChatHistoryForUser('user_2', [
    {
      id: 'message_user_2',
      role: 'user',
      content: 'hi from user 2',
      timestamp: 1713603600000,
    },
  ]);

  assert.equal(getSelectedCharacterForUser('user_2'), 'sunshine');
  assert.equal(getConversationIdForUser('user_2'), 'conversation_2');
  assert.equal(getChatHistoryForUser('user_2').length, 1);
  assert.equal(getChatHistoryForUser('user_2')[0]?.content, 'hi from user 2');

  markResumeSkipForUser('user_2');
  assert.equal(shouldSkipResumeForUser('user_2'), true);
  clearResumeSkipForUser('user_2');
  assert.equal(shouldSkipResumeForUser('user_2'), false);

  saveSelectedCharacterForUser('', 'ignored');
  saveConversationIdForUser('undefined', 'ignored');
  saveChatHistoryForUser('null', [oldMessage]);
  assert.equal(getSelectedCharacterForUser(''), null);
  assert.equal(getConversationIdForUser('undefined'), null);
  assert.deepEqual(getChatHistoryForUser('null'), []);

  clearConversationStateForUser('user_2');
  clearAllData();

  assert.equal(getSelectedCharacterForUser('user_2'), null);
  assert.equal(getConversationIdForUser('user_2'), null);
  assert.equal(getChatHistoryForUser('user_2').length, 0);
  assert.equal(getSelectedCharacter(), null);
  assert.deepEqual(getChatHistory(), []);

  console.log('conversation storage test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
