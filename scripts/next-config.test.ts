import assert from 'node:assert/strict';
import path from 'node:path';

import nextConfig from '../next.config';

async function main() {
  const expectedRoot = path.resolve(process.cwd());
  assert.equal(
    nextConfig.turbopack?.root,
    expectedRoot,
    'next.config.ts should pin turbopack.root to the project root',
  );

  console.log('next config test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
