import assert from 'node:assert/strict';

import { resetAiConfigForTests } from '@/lib/ai/config';

type FetchCall = {
  url: string | URL | Request;
  init?: RequestInit;
};

function createAudioResponse(text: string, init?: ResponseInit) {
  return new Response(Buffer.from(text), {
    headers: {
      'Content-Type': 'audio/mpeg',
      ...(init?.headers || {}),
    },
    status: init?.status,
  });
}

function setVoiceEnv() {
  process.env.SILICONFLOW_API_KEY = 'test-sf-key';
  process.env.SILICONFLOW_TTS_URL = 'https://api.siliconflow.cn/v1/audio/speech';
  process.env.SILICONFLOW_TTS_MODEL = 'FunAudioLLM/CosyVoice2-0.5B';
  process.env.SILICONFLOW_TTS_DEFAULT_VOICE = 'alex';
  process.env.SILICONFLOW_TTS_VOICE_UNCLE = 'dialect_uncle';
  process.env.SILICONFLOW_TTS_VOICE_SUNSHINE = 'dialect_sunshine';
  process.env.SILICONFLOW_TTS_VOICE_STRAIGHT_MAN = 'dialect_straight';
  resetAiConfigForTests();
}

async function main() {
  setVoiceEnv();

  const calls: FetchCall[] = [];

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url, init });
    return createAudioResponse('fake-mp3-binary', { status: 200 });
  }) as typeof fetch;

  const { synthesizeCharacterSpeech } = await import('../src/lib/ai/services/speech-service');

  await synthesizeCharacterSpeech({
    text: '嘿嘿~ 今天状态不错😊 https://example.com',
    characterId: 'sunshine',
  });

  assert.equal(calls.length, 1);
  const payload = JSON.parse(String(calls[0]?.init?.body));

  assert.equal(payload.model, 'FunAudioLLM/CosyVoice2-0.5B');
  assert.equal(payload.voice, 'FunAudioLLM/CosyVoice2-0.5B:alex');
  assert.equal(payload.input, '嘿嘿。 今天状态不错');

  console.log('speech service test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
