import assert from 'node:assert/strict';

async function main() {
  const { ChatLimitCard } = await import('../src/components/chat/chat-limit-card');

  const loginElement = ChatLimitCard({ mode: 'login' });
  const upgradeElement = ChatLimitCard({ mode: 'upgrade' });

  assert.ok(loginElement, 'login limit card should render');
  assert.ok(upgradeElement, 'upgrade limit card should render');
  assert.notEqual(loginElement, upgradeElement);

  console.log('chat limit card test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
