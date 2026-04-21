import assert from 'node:assert/strict';

async function main() {
  const { getSessionUserAvatarInitial, getSessionUserLabel } = await import(
    '../src/lib/session-user'
  );

  assert.equal(
    getSessionUserLabel({
      displayName: '红红',
      email: 'honghong@example.com',
    }),
    '红红',
  );

  assert.equal(
    getSessionUserLabel({
      displayName: '   ',
      email: 'fallback@example.com',
    }),
    'fallback@example.com',
  );

  assert.equal(
    getSessionUserLabel({
      displayName: null,
      email: 'reader@example.com',
    }),
    'reader@example.com',
  );

  assert.equal(
    getSessionUserAvatarInitial({
      displayName: '红红',
      email: 'honghong@example.com',
    }),
    '红',
  );

  assert.equal(
    getSessionUserAvatarInitial({
      displayName: '   ',
      email: 'reader@example.com',
    }),
    'R',
  );

  console.log('session user label test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
