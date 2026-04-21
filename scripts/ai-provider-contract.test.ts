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

function createAudioResponse(text: string, init?: ResponseInit) {
  return new Response(Buffer.from(text), {
    headers: {
      'Content-Type': 'audio/mpeg',
      ...(init?.headers || {}),
    },
    status: init?.status,
  });
}

function setRequiredEnv() {
  process.env.ARK_API_KEY = 'test-ark-key';
  process.env.ARK_BASE_URL = 'https://ark.example.com/api/v3';
  process.env.ARK_CHAT_MODEL = 'doubao-seed-2-0-pro-260215';
  process.env.ARK_VIDEO_BASE_URL = 'https://ark.example.com/api/v3';
  process.env.ARK_VIDEO_MODEL = 'doubao-seedance-1-5-pro-251215';

  process.env.SILICONFLOW_API_KEY = 'test-sf-key';
  process.env.SILICONFLOW_TTS_MODEL = 'FunAudioLLM/CosyVoice2-0.5B';
  process.env.SILICONFLOW_TTS_DEFAULT_VOICE = 'FunAudioLLM/CosyVoice2-0.5B:alex';
  process.env.SILICONFLOW_ASR_MODEL = 'FunAudioLLM/SenseVoiceSmall';
  process.env.SILICONFLOW_IMAGE_TEXT_MODEL = 'Kwai-Kolors/Kolors';
  process.env.SILICONFLOW_IMAGE_EDIT_MODEL = 'Qwen/Qwen-Image-Edit';
}

async function testArkProviderMapsMessages() {
  const calls: FetchCall[] = [];

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url, init });
    return createJsonResponse({
      id: 'resp_1',
      model: 'doubao-seed-2-0-pro-260215',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '你好呀' }],
        },
      ],
      usage: {
        input_tokens: 12,
        output_tokens: 8,
        total_tokens: 20,
      },
    });
  }) as typeof fetch;

  const { VolcengineArkResponsesProvider } = await import(
    '../src/lib/ai/providers/volcengine/ark-responses-provider'
  );

  const provider = new VolcengineArkResponsesProvider();
  const result = await provider.generateText({
    messages: [
      { role: 'system', content: '你是温柔男友' },
      { role: 'user', content: '打招呼' },
    ],
    temperature: 0.8,
    maxOutputTokens: 256,
    timeoutMs: 10_000,
  });

  assert.equal(result.provider, 'volcengine');
  assert.equal(result.text, '你好呀');
  assert.equal(result.usage?.totalTokens, 20);
  assert.equal(calls.length, 1);

  const [call] = calls;
  assert.equal(String(call.url), 'https://ark.example.com/api/v3/responses');
  assert.equal(call.init?.method, 'POST');

  const payload = JSON.parse(String(call.init?.body));
  assert.equal(payload.model, 'doubao-seed-2-0-pro-260215');
  assert.equal(payload.instructions, '你是温柔男友');
  assert.deepEqual(payload.input, [
    {
      role: 'user',
      content: [{ type: 'input_text', text: '打招呼' }],
    },
  ]);
}

async function testSiliconFlowSpeechProviderRetriesTtsAndTranscribesAsr() {
  const calls: FetchCall[] = [];

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url, init });

    if (String(url).includes('/audio/speech')) {
      if (calls.filter(call => String(call.url).includes('/audio/speech')).length === 1) {
        return createJsonResponse(
          { error: { message: 'temporary upstream issue' } },
          { status: 503 },
        );
      }

      return createAudioResponse('fake-mp3-binary', { status: 200 });
    }

    return createJsonResponse({ text: '识别成功' }, { status: 200 });
  }) as typeof fetch;

  const { SiliconFlowSpeechProvider } = await import(
    '../src/lib/ai/providers/siliconflow/speech-provider'
  );

  const provider = new SiliconFlowSpeechProvider();

  const ttsResult = await provider.synthesizeSpeech({
    text: '你好',
    voiceId: 'uncle',
    uid: 'uid_1',
    audioFormat: 'mp3',
    sampleRate: 24_000,
  });

  assert.equal(ttsResult.provider, 'siliconflow');
  assert.match(ttsResult.audioUrl, /^data:audio\/mpeg;base64,/);

  const asrResult = await provider.transcribeSpeech({
    audioBase64: 'data:audio/mpeg;base64,ZmFrZS1hdWRpbw==',
  });

  assert.equal(asrResult.provider, 'siliconflow');
  assert.equal(asrResult.text, '识别成功');

  const ttsCalls = calls.filter(call => String(call.url).includes('/audio/speech'));
  assert.equal(ttsCalls.length, 2, 'tts should retry once on 5xx');
  const lastTtsPayload = JSON.parse(String(ttsCalls.at(-1)?.init?.body));
  assert.equal(lastTtsPayload.sample_rate, 32000, 'mp3 tts should use a SiliconFlow-supported sample rate');

  const asrCall = calls.find(call => String(call.url).includes('/audio/transcriptions'));
  assert.ok(asrCall, 'asr request should be sent');
  assert.ok(asrCall?.init?.body instanceof FormData, 'asr should upload multipart form data');
  assert.equal((asrCall?.init?.body as FormData).get('model'), 'FunAudioLLM/SenseVoiceSmall');
}

async function testImageAndArkVideoProvidersMapReferenceMedia() {
  const calls: FetchCall[] = [];

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url, init });

    if (String(url).includes('/images/generations')) {
      return createJsonResponse({
        images: [{ url: 'https://example.com/generated.png' }],
        seed: 1234,
      });
    }

    if (String(url).includes('/contents/generations/tasks') && (init?.method || 'GET') === 'POST') {
      return createJsonResponse({ id: 'cgt_1' });
    }

    return createJsonResponse({
      id: 'cgt_1',
      status: 'succeeded',
      content: {
        video_url: 'https://example.com/generated.mp4',
      },
    });
  }) as typeof fetch;

  const { SiliconFlowImageProvider } = await import(
    '../src/lib/ai/providers/siliconflow/image-provider'
  );
  const { VolcengineArkVideoProvider } = await import(
    '../src/lib/ai/providers/volcengine/ark-video-provider'
  );

  const imageProvider = new SiliconFlowImageProvider();
  const imageResult = await imageProvider.generateImage({
    prompt: '生成自拍',
    referenceImage: 'https://example.com/reference.png',
  });

  assert.equal(imageResult.provider, 'siliconflow');
  assert.deepEqual(imageResult.imageUrls, ['https://example.com/generated.png']);

  const imagePayload = JSON.parse(
    String(calls.find(call => String(call.url).includes('/images/generations'))?.init?.body),
  );
  assert.equal(imagePayload.model, 'Qwen/Qwen-Image-Edit');
  assert.equal(imagePayload.image, 'https://example.com/reference.png');

  const videoProvider = new VolcengineArkVideoProvider();
  const videoResult = await videoProvider.generateVideo({
    prompt: '生成跳舞视频',
    ratio: '16:9',
    resolution: '480p',
    duration: 3,
    firstFrameUrl: 'https://example.com/first-frame.png',
  });

  assert.equal(videoResult.provider, 'volcengine');
  assert.equal(videoResult.videoUrl, 'https://example.com/generated.mp4');

  const videoSubmitPayload = JSON.parse(
    String(
      calls.find(
        call =>
          String(call.url).includes('/contents/generations/tasks') &&
          (call.init?.method || 'GET') === 'POST',
      )?.init?.body,
    ),
  );
  assert.equal(videoSubmitPayload.model, 'doubao-seedance-1-5-pro-251215');
  assert.equal(videoSubmitPayload.duration, undefined);
  assert.equal(videoSubmitPayload.resolution, '480p');
  assert.equal(videoSubmitPayload.generate_audio, true);
  assert.equal(videoSubmitPayload.content[0].text, '生成跳舞视频');
  assert.equal(videoSubmitPayload.content[1].image_url.url, 'https://example.com/first-frame.png');
}

async function main() {
  setRequiredEnv();

  await testArkProviderMapsMessages();
  await testSiliconFlowSpeechProviderRetriesTtsAndTranscribesAsr();
  await testImageAndArkVideoProvidersMapReferenceMedia();

  console.log('ai provider contract test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
