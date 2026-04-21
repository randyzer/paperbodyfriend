import assert from 'node:assert/strict';

async function main() {
  const { createTtsRouteHandler } = await import(
    '../src/server/media/tts-route-handler'
  );

  const calls: {
    uploaded?: {
      userId: string;
      contentType: string;
      extension: string;
      size: number;
    };
  } = {};

  const handler = createTtsRouteHandler({
    async getCurrentUser() {
      return { id: 'user_1' };
    },
    async synthesizeSpeech() {
      return {
        audioUrl: `data:audio/mpeg;base64,${Buffer.from('fake-audio').toString('base64')}`,
        audioSize: 10,
        contentType: 'audio/mpeg',
      };
    },
    async uploadAudio(input) {
      calls.uploaded = {
        userId: input.userId,
        contentType: input.contentType,
        extension: input.extension,
        size: input.buffer.length,
      };
      return 'https://cdn.example.com/audio/user_1/permanent.mp3';
    },
  });

  const response = await handler(
    new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '你好呀',
        characterId: 'uncle',
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    audioUri: 'https://cdn.example.com/audio/user_1/permanent.mp3',
    audioSize: 10,
  });
  assert.deepEqual(calls.uploaded, {
    userId: 'user_1',
    contentType: 'audio/mpeg',
    extension: 'mp3',
    size: Buffer.from('fake-audio').length,
  });

  const badRequestResponse = await handler(
    new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: 'uncle' }),
    }),
  );

  assert.equal(badRequestResponse.status, 400);
  assert.deepEqual(await badRequestResponse.json(), {
    error: '缺少文本内容',
  });

  console.log('tts route handler test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
