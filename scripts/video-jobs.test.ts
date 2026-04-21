import assert from 'node:assert/strict';

async function main() {
  const { CLIENT_VIDEO_POLL_INTERVAL_MS, CLIENT_VIDEO_POLL_MAX_ATTEMPTS, isPendingVideoMessage } =
    await import('../src/lib/video-jobs');

  assert.equal(CLIENT_VIDEO_POLL_INTERVAL_MS, 10000);
  assert.equal(CLIENT_VIDEO_POLL_MAX_ATTEMPTS, 180);

  assert.equal(
    isPendingVideoMessage({
      id: 'msg_1',
      role: 'assistant',
      content: '视频还在排队中，等有结果我再发你',
      timestamp: Date.now(),
      type: 'text',
      videoStatus: 'pending',
      videoRequestId: 'req_1',
      pendingCaption: '给你跳个舞',
      mediaKind: 'dance',
    }),
    true,
  );

  assert.equal(
    isPendingVideoMessage({
      id: 'msg_2',
      role: 'assistant',
      content: '普通文本',
      timestamp: Date.now(),
      type: 'text',
    }),
    false,
  );

  console.log('video jobs test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
