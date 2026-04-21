import assert from 'node:assert/strict';

import { resetAiConfigForTests } from '@/lib/ai/config';
import {
  normalizeSiliconFlowVoice,
  resolveCharacterVoice,
} from '@/lib/ai/utils/media';

function setVoiceEnv() {
  process.env.SILICONFLOW_TTS_MODEL = 'FunAudioLLM/CosyVoice2-0.5B';
  process.env.SILICONFLOW_TTS_DEFAULT_VOICE = 'alex';
  process.env.SILICONFLOW_TTS_VOICE_UNCLE = 'dialect_uncle';
  process.env.SILICONFLOW_TTS_VOICE_SUNSHINE = 'dialect_sunshine';
  process.env.SILICONFLOW_TTS_VOICE_STRAIGHT_MAN = 'dialect_straight';
  resetAiConfigForTests();
}

function main() {
  setVoiceEnv();

  const expectedVoice = normalizeSiliconFlowVoice(
    'alex',
    'FunAudioLLM/CosyVoice2-0.5B',
  );

  assert.equal(resolveCharacterVoice(), expectedVoice);
  assert.equal(resolveCharacterVoice('uncle'), expectedVoice);
  assert.equal(resolveCharacterVoice('sunshine'), expectedVoice);
  assert.equal(resolveCharacterVoice('straight_man'), expectedVoice);

  console.log('tts voice selection test passed.');
}

main();
