import assert from 'node:assert/strict';

async function main() {
  const { detectMediaIntent } = await import('../src/lib/ai/media-intent');

  assert.equal(detectMediaIntent('好久不见，发个近期照片看看'), 'selfie');
  assert.equal(detectMediaIntent('给我拍个视频看看'), 'dance');
  assert.equal(detectMediaIntent('录个视频发我'), 'dance');
  assert.equal(detectMediaIntent('来个科目三看看'), 'dance');
  assert.equal(detectMediaIntent('给我看小苹果'), 'dance');
  assert.equal(detectMediaIntent('跳个科目三给我看'), 'dance');
  assert.equal(detectMediaIntent('看你健身视频'), 'workout');
  assert.equal(detectMediaIntent('我们聊聊天吧'), null);

  console.log('media intent test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
