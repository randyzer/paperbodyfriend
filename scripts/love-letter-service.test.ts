import assert from 'node:assert/strict';

async function main() {
  const { createLoveLetterService } = await import(
    '../src/lib/ai/services/love-letter-service'
  );

  const prompts: string[] = [];
  const userRequests: string[] = [];

  const service = createLoveLetterService({
    async generateText(input) {
      prompts.push(input.systemPrompt);
      userRequests.push(input.userPrompt);
      return '今天一整天都会把你放在心上。';
    },
  });

  const sunshineResult = await service.generateLoveLetter({
    userName: 'Randy',
    characterId: 'sunshine',
  });

  assert.equal(sunshineResult, '今天一整天都会把你放在心上。');
  assert.match(prompts[0] ?? '', /阳光/);
  assert.match(userRequests[0] ?? '', /Randy/);

  await service.generateLoveLetter({
    userName: 'Fallback',
  });

  assert.match(prompts[1] ?? '', /温柔/);

  console.log('love letter service test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
