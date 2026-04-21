import { getAiConfig, isArkConfigured } from '@/lib/ai/config';
import { ProviderRequestError } from '@/lib/ai/errors';
import {
  VideoGenerationProvider,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoStatusRequest,
  VideoStatusResult,
  VideoSubmitResult,
} from '@/lib/ai/types';
import { pollUntil } from '@/lib/ai/utils/polling';

function buildVideoPrompt(input: VideoGenerationRequest): string {
  return input.prompt.trim();
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

export class VolcengineArkVideoProvider implements VideoGenerationProvider {
  readonly name = 'volcengine' as const;

  isAvailable(): boolean {
    return isArkConfigured();
  }

  async submitVideo(input: VideoGenerationRequest): Promise<VideoSubmitResult> {
    const config = getAiConfig();

    if (!config.arkApiKey) {
      throw new ProviderRequestError({
        provider: this.name,
        message: 'Volcengine Ark API key is not configured',
        statusCode: 401,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs || config.requestTimeoutMs,
    );

    try {
      const content: Array<Record<string, unknown>> = [
        {
          type: 'text',
          text: buildVideoPrompt(input),
        },
      ];

      if (input.firstFrameUrl) {
        content.push({
          type: 'image_url',
          image_url: {
            url: input.firstFrameUrl,
          },
        });
      }

      const payload: Record<string, unknown> = {
        model: config.arkVideoModel,
        content,
        ...(!input.firstFrameUrl && typeof input.duration === 'number'
          ? { duration: input.duration }
          : {}),
        ...(input.ratio ? { ratio: input.ratio } : {}),
        ...(input.resolution ? { resolution: input.resolution } : {}),
        watermark: config.arkVideoWatermark,
        generate_audio: config.arkVideoGenerateAudio,
        draft: config.arkVideoDraft,
        return_last_frame: config.arkVideoReturnLastFrame,
      };

      if (!input.firstFrameUrl) {
        payload.camera_fixed = config.arkVideoCameraFixed;
      }

      const response = await fetch(`${config.arkVideoBaseUrl}/contents/generations/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.arkApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ProviderRequestError({
          provider: this.name,
          message: await readErrorDetail(response),
          statusCode: response.status,
        });
      }

      const responsePayload = await response.json();
      const requestId =
        responsePayload &&
        typeof responsePayload === 'object' &&
        responsePayload !== null &&
        typeof (responsePayload as Record<string, unknown>).id === 'string'
          ? String((responsePayload as Record<string, unknown>).id)
          : '';

      if (!requestId) {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'Volcengine Ark video submit returned no task id',
          statusCode: 502,
          details: responsePayload,
        });
      }

      return {
        provider: this.name,
        requestId,
        status: 'queued',
        statusCode: response.status,
        raw: responsePayload,
      };
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'Volcengine Ark video submit timed out',
          statusCode: 504,
          details: error,
        });
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: error instanceof Error ? error.message : 'Volcengine Ark video submit failed',
        statusCode: 502,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async getVideoStatus(input: VideoStatusRequest): Promise<VideoStatusResult> {
    const config = getAiConfig();

    if (!config.arkApiKey) {
      throw new ProviderRequestError({
        provider: this.name,
        message: 'Volcengine Ark API key is not configured',
        statusCode: 401,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs || config.requestTimeoutMs,
    );

    try {
      const response = await fetch(
        `${config.arkVideoBaseUrl}/contents/generations/tasks/${input.requestId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.arkApiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new ProviderRequestError({
          provider: this.name,
          message: await readErrorDetail(response),
          statusCode: response.status,
        });
      }

      const payload = await response.json();
      const status =
        payload &&
        typeof payload === 'object' &&
        payload !== null &&
        typeof (payload as Record<string, unknown>).status === 'string'
          ? String((payload as Record<string, unknown>).status)
          : '';

      const reason =
        payload &&
        typeof payload === 'object' &&
        payload !== null &&
        typeof (payload as Record<string, unknown>).error === 'string'
          ? String((payload as Record<string, unknown>).error)
          : '';

      const videoUrl =
        payload &&
        typeof payload === 'object' &&
        payload !== null &&
        typeof (payload as Record<string, unknown>).content === 'object' &&
        (payload as Record<string, unknown>).content !== null &&
        typeof (
          (payload as Record<string, unknown>).content as Record<string, unknown>
        ).video_url === 'string'
          ? String(
              ((payload as Record<string, unknown>).content as Record<string, unknown>)
                .video_url,
            )
          : undefined;

      if (status === 'succeeded' && videoUrl) {
        return {
          provider: this.name,
          requestId: input.requestId,
          status: 'completed',
          videoUrl,
          statusCode: response.status,
          raw: payload,
        };
      }

      if (status === 'failed' || status === 'expired' || status === 'canceled') {
        return {
          provider: this.name,
          requestId: input.requestId,
          status: 'failed',
          reason: reason || 'Volcengine Ark video generation failed',
          statusCode: response.status,
          raw: payload,
        };
      }

      return {
        provider: this.name,
        requestId: input.requestId,
        status: 'processing',
        reason,
        statusCode: response.status,
        raw: payload,
      };
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'Volcengine Ark video status request timed out',
          statusCode: 504,
          details: error,
        });
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: error instanceof Error ? error.message : 'Volcengine Ark video status request failed',
        statusCode: 502,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateVideo(input: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const config = getAiConfig();
    const submitResult = await this.submitVideo(input);

    const statusPayload = await pollUntil(
      () =>
        this.getVideoStatus({
          requestId: submitResult.requestId,
          timeoutMs: input.timeoutMs || config.videoTimeoutMs,
        }),
      result => result.status === 'completed' || result.status === 'failed',
      {
        intervalMs: input.pollIntervalMs || config.videoPollIntervalMs,
        maxAttempts: input.maxPollAttempts || config.videoPollMaxAttempts,
      },
    );

    if (statusPayload.status !== 'completed' || !statusPayload.videoUrl) {
      throw new ProviderRequestError({
        provider: this.name,
        message: statusPayload.reason || 'Volcengine Ark video generation failed',
        statusCode:
          statusPayload.status === 'processing' || statusPayload.status === 'queued'
            ? 504
            : 502,
        details: statusPayload.raw,
      });
    }

    return {
      provider: this.name,
      videoUrl: statusPayload.videoUrl,
      duration: input.duration,
      ratio: input.ratio,
      resolution: input.resolution,
      statusCode: statusPayload.statusCode,
      requestId: submitResult.requestId,
      raw: statusPayload.raw,
    };
  }
}
