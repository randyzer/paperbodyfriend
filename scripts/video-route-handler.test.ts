import assert from 'node:assert/strict';

async function main() {
  const { createVideoRouteHandler } = await import(
    '../src/server/media/video-route-handler'
  );

  const calls: {
    statusRequestId?: string;
    downloadedUrl?: string;
    uploaded?: {
      userId: string;
      contentType: string;
      extension: string;
      size: number;
    };
  } = {};

  const handler = createVideoRouteHandler({
    async getCurrentUser() {
      return { id: 'user_1' };
    },
    async submitVideo() {
      return {
        requestId: 'video_request_1',
        status: 'queued',
      };
    },
    async getVideoStatus({ requestId }) {
      calls.statusRequestId = requestId;
      return {
        requestId,
        status: 'completed',
        videoUrl: 'https://example.com/temp/generated.mp4?sign=temp',
      };
    },
    async downloadVideo(url) {
      calls.downloadedUrl = url;
      return {
        buffer: Buffer.from('fake-video-binary'),
        contentType: 'video/mp4',
      };
    },
    async uploadVideo(input) {
      calls.uploaded = {
        userId: input.userId,
        contentType: input.contentType,
        extension: input.extension,
        size: input.buffer.length,
      };
      return 'https://cdn.example.com/videos/user_1/permanent.mp4';
    },
  });

  const submitResponse = await handler(
    new Request('http://localhost/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '给我生成一个跳舞视频',
      }),
    }),
  );

  assert.equal(submitResponse.status, 200);
  assert.deepEqual(await submitResponse.json(), {
    requestId: 'video_request_1',
    status: 'queued',
  });

  const statusResponse = await handler(
    new Request('http://localhost/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: 'video_request_1',
      }),
    }),
  );

  assert.equal(statusResponse.status, 200);
  const statusPayload = await statusResponse.json();
  assert.equal(statusPayload.requestId, 'video_request_1');
  assert.equal(statusPayload.status, 'completed');
  assert.equal(
    statusPayload.videoUrl,
    'https://cdn.example.com/videos/user_1/permanent.mp4',
  );
  assert.equal(calls.statusRequestId, 'video_request_1');
  assert.equal(
    calls.downloadedUrl,
    'https://example.com/temp/generated.mp4?sign=temp',
  );
  assert.deepEqual(calls.uploaded, {
    userId: 'user_1',
    contentType: 'video/mp4',
    extension: 'mp4',
    size: Buffer.from('fake-video-binary').length,
  });

  console.log('video route handler test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
