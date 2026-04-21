import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readScript(name: string) {
  const filePath = path.join(process.cwd(), 'scripts', name);
  return readFile(filePath, 'utf8');
}

async function main() {
  const buildScript = await readScript('build.sh');
  const prepareScript = await readScript('prepare.sh');

  assert.ok(
    !buildScript.includes('pnpm install'),
    'build.sh should not reinstall dependencies during the build phase',
  );
  assert.ok(
    buildScript.includes('pnpm next build'),
    'build.sh should still run the Next.js build',
  );
  assert.ok(
    !prepareScript.includes('pnpm install'),
    'prepare.sh should not reinstall dependencies implicitly',
  );

  console.log('build script test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
