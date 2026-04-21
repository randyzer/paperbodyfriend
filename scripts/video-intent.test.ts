import assert from 'node:assert/strict';

async function main() {
  const { resolveRequestedVideoPlan } = await import('../src/lib/ai/video-intent');

  const dancePlan = resolveRequestedVideoPlan({
    kind: 'dance',
    basePrompt: 'A handsome young Asian man dancing with energetic moves',
    userRequest: '给我跳个科目三',
  });

  assert.match(dancePlan.prompt, /科目三/);
  assert.match(dancePlan.prompt, /严格优先满足这次的编舞要求/);
  assert.match(dancePlan.prompt, /不要泛化成普通跳舞视频/);
  assert.equal(dancePlan.useReferenceImage, false);
  assert.equal(dancePlan.options.duration, 4);
  assert.equal(dancePlan.options.resolution, '480p');
  assert.equal(dancePlan.options.ratio, '16:9');

  const fallbackPlan = resolveRequestedVideoPlan({
    kind: 'dance',
    basePrompt: 'base dance prompt',
    userRequest: '跳个舞给我看',
  });

  assert.equal(fallbackPlan.prompt, 'base dance prompt');
  assert.equal(fallbackPlan.useReferenceImage, true);
  assert.equal(fallbackPlan.options.duration, 3);
  assert.equal(fallbackPlan.options.resolution, '480p');

  const workoutPlan = resolveRequestedVideoPlan({
    kind: 'workout',
    basePrompt: 'base workout prompt',
    userRequest: '给我看你练胸和俯卧撑',
  });

  assert.match(workoutPlan.prompt, /练胸和俯卧撑/);
  assert.equal(workoutPlan.useReferenceImage, true);
  assert.equal(workoutPlan.options.duration, 3);

  console.log('video intent test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
