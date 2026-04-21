import assert from 'node:assert/strict';

type FetchCall = {
  url: string | URL | Request;
  init?: RequestInit;
};

function createJsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    status: init?.status,
  });
}

async function main() {
  process.env.ARK_API_KEY = 'test-ark-key';
  process.env.ARK_BASE_URL = 'https://ark.example.com/api/v3';
  process.env.ARK_VIDEO_MODEL = 'doubao-seedance-1-5-pro-251215';

  const calls: FetchCall[] = [];

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url, init });

    if (String(url).includes('/contents/generations/tasks') && (init?.method || 'GET') === 'POST') {
      return createJsonResponse({ id: 'cgt-20260420150047-p5wkf' });
    }

    return createJsonResponse({
      id: 'cgt-20260420150047-p5wkf',
      model: 'doubao-seedance-1-5-pro-251215',
      status: 'running',
      content: null,
      updated_at: 1776668505,
    });
  }) as typeof fetch;

  const { VolcengineArkVideoProvider } = await import(
    '../src/lib/ai/providers/volcengine/ark-video-provider'
  );

  const provider = new VolcengineArkVideoProvider();
  const submitResult = await provider.submitVideo({
    prompt: '给我来段跳舞视频',
    ratio: '16:9',
    resolution: '480p',
    duration: 3,
    firstFrameUrl: 'https://example.com/first-frame.png',
  });

  assert.equal(submitResult.provider, 'volcengine');
  assert.equal(submitResult.requestId, 'cgt-20260420150047-p5wkf');
  assert.equal(submitResult.status, 'queued');

  const submitPayload = JSON.parse(
    String(
      calls.find(
        call =>
          String(call.url).includes('/contents/generations/tasks') &&
          (call.init?.method || 'GET') === 'POST',
      )?.init?.body,
    ),
  );
  assert.equal(submitPayload.model, 'doubao-seedance-1-5-pro-251215');
  assert.equal(submitPayload.duration, undefined);
  assert.equal(submitPayload.resolution, '480p');
  assert.equal(submitPayload.ratio, '16:9');
  assert.equal(submitPayload.watermark, true);
  assert.equal(submitPayload.generate_audio, true);
  assert.equal(submitPayload.camera_fixed, undefined);
  assert.equal(submitPayload.content[0].type, 'text');
  assert.equal(submitPayload.content[0].text, '给我来段跳舞视频');
  assert.equal(submitPayload.content[1].type, 'image_url');
  assert.equal(submitPayload.content[1].image_url.url, 'https://example.com/first-frame.png');

  const statusResult = await provider.getVideoStatus({
    requestId: 'cgt-20260420150047-p5wkf',
  });

  assert.equal(statusResult.provider, 'volcengine');
  assert.equal(statusResult.status, 'processing');
  assert.equal(statusResult.requestId, 'cgt-20260420150047-p5wkf');

  console.log('video provider flow test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
