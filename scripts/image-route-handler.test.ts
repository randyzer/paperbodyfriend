import assert from 'node:assert/strict';

async function main() {
  const { createImageRouteHandler } = await import(
    '../src/server/media/image-route-handler'
  );

  const calls: {
    downloadedUrl?: string;
    uploaded?: {
      userId: string;
      contentType: string;
      extension: string;
      size: number;
    };
  } = {};

  const handler = createImageRouteHandler({
    async getCurrentUser() {
      return { id: 'user_1' };
    },
    async generateImage() {
      return {
        imageUrls: ['https://example.com/temp/generated.png?sign=temp'],
      };
    },
    async downloadImage(url) {
      calls.downloadedUrl = url;
      return {
        buffer: Buffer.from('fake-image-binary'),
        contentType: 'image/png',
      };
    },
    async uploadImage(input) {
      calls.uploaded = {
        userId: input.userId,
        contentType: input.contentType,
        extension: input.extension,
        size: input.buffer.length,
      };
      return 'https://cdn.example.com/images/user_1/permanent.png';
    },
  });

  const response = await handler(
    new Request('http://localhost/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '生成一张自拍',
        referenceImage: 'https://example.com/reference.png',
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    imageUrls: ['https://cdn.example.com/images/user_1/permanent.png'],
  });
  assert.equal(
    calls.downloadedUrl,
    'https://example.com/temp/generated.png?sign=temp',
  );
  assert.deepEqual(calls.uploaded, {
    userId: 'user_1',
    contentType: 'image/png',
    extension: 'png',
    size: Buffer.from('fake-image-binary').length,
  });

  const badRequestResponse = await handler(
    new Request('http://localhost/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );

  assert.equal(badRequestResponse.status, 400);
  assert.deepEqual(await badRequestResponse.json(), {
    error: '缺少提示词',
  });

  console.log('image route handler test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
