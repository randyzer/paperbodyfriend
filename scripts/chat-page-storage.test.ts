import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function main() {
  const chatPageSource = await readFile(
    new URL('../src/app/chat/page.tsx', import.meta.url),
    'utf8',
  );
  const homePageSource = await readFile(
    new URL('../src/app/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(chatPageSource, /getSelectedCharacterForUser/);
  assert.match(chatPageSource, /getConversationIdForUser/);
  assert.match(chatPageSource, /getChatHistoryForUser/);
  assert.match(chatPageSource, /saveChatHistoryForUser/);
  assert.match(chatPageSource, /clearConversationStateForUser/);
  assert.match(chatPageSource, /markResumeSkipForUser/);
  assert.match(homePageSource, /shouldSkipResumeForUser/);

  assert.doesNotMatch(chatPageSource, /\bgetSelectedCharacter\b/);
  assert.doesNotMatch(chatPageSource, /\bgetChatHistory\b/);
  assert.doesNotMatch(chatPageSource, /\bsaveChatHistory\b/);
  assert.doesNotMatch(chatPageSource, /\bclearAllData\b/);

  console.log('chat page storage usage test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
