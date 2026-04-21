import { getAiConfig } from '@/lib/ai/config';
import { getErrorSummary, ProviderRequestError } from '@/lib/ai/errors';
import { logAiEvent } from '@/lib/ai/logger';
import { getSpeechProvider } from '@/lib/ai/provider-factory';
import {
  SpeechSynthesisResult,
  SpeechTranscriptionResult,
} from '@/lib/ai/types';
import { normalizeTtsInputText, resolveCharacterVoice } from '@/lib/ai/utils/media';

export async function synthesizeCharacterSpeech(input: {
  text: string;
  characterId?: string;
}): Promise<SpeechSynthesisResult> {
  const config = getAiConfig();
  const provider = getSpeechProvider();
  const startedAt = Date.now();

  logAiEvent('info', {
    event: 'request_start',
    capability: 'speech_tts',
    provider: provider.name,
    model: config.siliconflowTtsModel,
  });

  try {
    const normalizedText = normalizeTtsInputText(input.text);

    const result = await provider.synthesizeSpeech({
      text: normalizedText,
      voiceId: resolveCharacterVoice(input.characterId),
      uid: `ai_boyfriend_${Date.now()}`,
      audioFormat: 'mp3',
      sampleRate: 24_000,
      timeoutMs: config.speechTimeoutMs,
    });

    logAiEvent('info', {
      event: 'request_end',
      capability: 'speech_tts',
      provider: result.provider,
      model: config.siliconflowTtsModel,
      durationMs: Date.now() - startedAt,
      statusCode: result.statusCode,
      requestId: result.requestId,
      summary: `audioSize=${result.audioSize}`,
    });

    return result;
  } catch (error) {
    const statusCode =
      error instanceof ProviderRequestError ? error.statusCode : undefined;

    logAiEvent('error', {
      event: 'request_error',
      capability: 'speech_tts',
      provider: provider.name,
      model: config.siliconflowTtsModel,
      durationMs: Date.now() - startedAt,
      statusCode,
      summary: getErrorSummary(error),
    });

    throw error;
  }
}

export async function transcribeAudio(input: {
  audioBase64: string;
}): Promise<SpeechTranscriptionResult> {
  const config = getAiConfig();
  const provider = getSpeechProvider();
  const startedAt = Date.now();

  logAiEvent('info', {
    event: 'request_start',
    capability: 'speech_asr',
    provider: provider.name,
    model: config.siliconflowAsrModel,
  });

  try {
    const result = await provider.transcribeSpeech({
      audioBase64: input.audioBase64,
      timeoutMs: config.speechTimeoutMs,
    });

    logAiEvent('info', {
      event: 'request_end',
      capability: 'speech_asr',
      provider: result.provider,
      model: config.siliconflowAsrModel,
      durationMs: Date.now() - startedAt,
      statusCode: result.statusCode,
      requestId: result.requestId,
      summary: result.text.slice(0, 120),
    });

    return result;
  } catch (error) {
    const statusCode =
      error instanceof ProviderRequestError ? error.statusCode : undefined;

    logAiEvent('error', {
      event: 'request_error',
      capability: 'speech_asr',
      provider: provider.name,
      model: config.siliconflowAsrModel,
      durationMs: Date.now() - startedAt,
      statusCode,
      summary: getErrorSummary(error),
    });

    throw error;
  }
}
