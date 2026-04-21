import { getAiConfig, isSiliconFlowConfigured } from '@/lib/ai/config';
import { ProviderRequestError } from '@/lib/ai/errors';
import {
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from '@/lib/ai/types';

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

export class SiliconFlowImageProvider implements ImageGenerationProvider {
  readonly name = 'siliconflow' as const;

  isAvailable(): boolean {
    return isSiliconFlowConfigured();
  }

  async generateImage(
    input: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
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
      input.timeoutMs || config.imageTimeoutMs,
    );

    try {
      const payload = input.referenceImage
        ? {
            model: config.siliconflowImageEditModel,
            prompt: input.prompt,
            image: input.referenceImage,
          }
        : {
            model: config.siliconflowImageTextModel,
            prompt: input.prompt,
            image_size: input.imageSize || config.siliconflowImageSize,
            batch_size: 1,
            num_inference_steps: 20,
            guidance_scale: 7.5,
          };

      const response = await fetch(config.siliconflowImageUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.siliconflowApiKey}`,
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

      const data = await response.json();
      const imageUrls = [
        ...(Array.isArray(data?.images) ? data.images : []),
        ...(Array.isArray(data?.data) ? data.data : []),
      ]
        .map(item =>
          item && typeof item === 'object' && 'url' in item ? String(item.url) : '',
        )
        .filter(Boolean);

      if (imageUrls.length === 0) {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'SiliconFlow image generation returned no image URL',
          statusCode: 502,
          details: data,
        });
      }

      return {
        provider: this.name,
        imageUrls,
        seed: typeof data?.seed === 'number' ? data.seed : undefined,
        statusCode: response.status,
        requestId: response.headers.get('x-siliconcloud-trace-id') || undefined,
        raw: data,
      };
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'SiliconFlow image request timed out',
          statusCode: 504,
          details: error,
        });
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: error instanceof Error ? error.message : 'SiliconFlow image request failed',
        statusCode: 502,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
