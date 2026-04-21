import { Buffer } from 'node:buffer';

import { getAiConfig, isSiliconFlowConfigured } from '@/lib/ai/config';
import { ProviderRequestError } from '@/lib/ai/errors';
import { logAiEvent } from '@/lib/ai/logger';
import {
  SpeechProvider,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  SpeechTranscriptionRequest,
  SpeechTranscriptionResult,
} from '@/lib/ai/types';
import {
  parseBase64AudioPayload,
  resolveAudioContentType,
} from '@/lib/ai/utils/media';

const SILICONFLOW_TTS_MAX_ATTEMPTS = 2;

function resolveSpeechSampleRate(
  responseFormat: 'mp3' | 'pcm' | 'opus',
  requestedSampleRate?: number,
): number | undefined {
  if (responseFormat === 'mp3') {
    return requestedSampleRate === 44_100 ? 44_100 : 32_000;
  }

  return requestedSampleRate;
}

async function readErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;

      if (record.error && typeof record.error === 'object' && record.error !== null) {
        const errorRecord = record.error as Record<string, unknown>;
        if (typeof errorRecord.message === 'string') {
          return errorRecord.message;
        }
      }

      if (typeof record.message === 'string') {
        return record.message;
      }
    }
  }

  return response.text();
}

export class SiliconFlowSpeechProvider implements SpeechProvider {
  readonly name = 'siliconflow' as const;

  isAvailable(): boolean {
    return isSiliconFlowConfigured();
  }

  async synthesizeSpeech(input: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
    const config = getAiConfig();

    if (!config.siliconflowApiKey) {
      throw new ProviderRequestError({
        provider: this.name,
        message: 'SiliconFlow API key is not configured',
        statusCode: 401,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs || config.speechTimeoutMs,
    );

    try {
      for (let attempt = 1; attempt <= SILICONFLOW_TTS_MAX_ATTEMPTS; attempt += 1) {
        try {
          const responseFormat = input.audioFormat === 'ogg_opus' ? 'opus' : input.audioFormat || 'mp3';
          const sampleRate = resolveSpeechSampleRate(responseFormat, input.sampleRate);

          const response = await fetch(config.siliconflowTtsUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.siliconflowApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.siliconflowTtsModel,
              input: input.text,
              voice: input.voiceId,
              response_format: responseFormat,
              ...(typeof sampleRate === 'number' ? { sample_rate: sampleRate } : {}),
              stream: config.siliconflowTtsStream,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new ProviderRequestError({
              provider: this.name,
              message: await readErrorDetail(response),
              statusCode: response.status,
            });
          }

          const arrayBuffer = await response.arrayBuffer();

          if (arrayBuffer.byteLength === 0) {
            throw new ProviderRequestError({
              provider: this.name,
              message: 'SiliconFlow TTS returned empty audio data',
              statusCode: 502,
            });
          }

          const contentType = resolveAudioContentType(
            responseFormat,
            response.headers.get('content-type'),
          );

          return {
            provider: this.name,
            audioUrl: `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`,
            audioSize: arrayBuffer.byteLength,
            contentType,
            statusCode: response.status,
            requestId: response.headers.get('x-siliconcloud-trace-id') || undefined,
            raw: {
              byteLength: arrayBuffer.byteLength,
              attempts: attempt,
            },
          };
        } catch (error) {
          if (
            error instanceof ProviderRequestError &&
            typeof error.statusCode === 'number' &&
            error.statusCode >= 500 &&
            error.statusCode < 600 &&
            attempt < SILICONFLOW_TTS_MAX_ATTEMPTS
          ) {
            logAiEvent('warn', {
              event: 'request_retry',
              capability: 'speech_tts',
              provider: this.name,
              statusCode: error.statusCode,
              summary: 'retrying after upstream 5xx',
              attempt,
              maxAttempts: SILICONFLOW_TTS_MAX_ATTEMPTS,
            });
            continue;
          }

          throw error;
        }
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: 'SiliconFlow TTS failed after retries',
        statusCode: 502,
      });
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'SiliconFlow TTS request timed out',
          statusCode: 504,
          details: error,
        });
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: error instanceof Error ? error.message : 'SiliconFlow TTS failed',
        statusCode: 502,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async transcribeSpeech(
    input: SpeechTranscriptionRequest,
  ): Promise<SpeechTranscriptionResult> {
    const config = getAiConfig();

    if (!config.siliconflowApiKey) {
      throw new ProviderRequestError({
        provider: this.name,
        message: 'SiliconFlow API key is not configured',
        statusCode: 401,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs || config.speechTimeoutMs,
    );

    try {
      const parsed = parseBase64AudioPayload(input.audioBase64);
      const formData = new FormData();

      formData.append(
        'file',
        new Blob([Uint8Array.from(parsed.bytes)], { type: parsed.contentType }),
        `speech-input.${parsed.extension}`,
      );
      formData.append('model', config.siliconflowAsrModel);

      const response = await fetch(config.siliconflowAsrUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.siliconflowApiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ProviderRequestError({
          provider: this.name,
          message: await readErrorDetail(response),
          statusCode: response.status,
        });
      }

      const payload = await response.json();
      const text =
        payload && typeof payload === 'object' && payload !== null && typeof payload.text === 'string'
          ? payload.text.trim()
          : '';

      if (!text) {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'SiliconFlow ASR returned empty text',
          statusCode: 502,
          details: payload,
        });
      }

      return {
        provider: this.name,
        text,
        statusCode: response.status,
        requestId: response.headers.get('x-siliconcloud-trace-id') || undefined,
        raw: payload,
      };
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'SiliconFlow ASR request timed out',
          statusCode: 504,
          details: error,
        });
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: error instanceof Error ? error.message : 'SiliconFlow ASR failed',
        statusCode: 502,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
