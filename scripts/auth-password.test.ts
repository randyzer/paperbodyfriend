import assert from 'node:assert/strict';

async function main() {
  const { hashPassword, verifyPassword } = await import(
    '../src/server/auth/password'
  );

  const password = 'S3curePass!123';
  const passwordHash = await hashPassword(password);

  assert.notEqual(
    passwordHash,
    password,
    'password should never be stored in plain text',
  );
  assert.match(passwordHash, /^scrypt\$/);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('wrong-password', passwordHash), false);

  console.log('auth password test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
