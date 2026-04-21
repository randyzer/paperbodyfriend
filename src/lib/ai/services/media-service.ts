import { getAiConfig } from '@/lib/ai/config';
import { getErrorSummary, ProviderRequestError } from '@/lib/ai/errors';
import { logAiEvent } from '@/lib/ai/logger';
import { getImageProvider, getVideoProvider } from '@/lib/ai/provider-factory';
import {
  ImageGenerationResult,
  VideoGenerationResult,
  VideoStatusResult,
  VideoSubmitResult,
} from '@/lib/ai/types';

export async function generateCharacterImage(input: {
  prompt: string;
  referenceImage?: string;
}): Promise<ImageGenerationResult> {
  const config = getAiConfig();
  const provider = getImageProvider();
  const startedAt = Date.now();

  logAiEvent('info', {
    event: 'request_start',
    capability: 'image_generate',
    provider: provider.name,
    model: input.referenceImage
      ? config.siliconflowImageEditModel
      : config.siliconflowImageTextModel,
  });

  try {
    const result = await provider.generateImage({
      prompt: input.prompt,
      referenceImage: input.referenceImage,
      imageSize: config.siliconflowImageSize,
      timeoutMs: config.imageTimeoutMs,
    });

    logAiEvent('info', {
      event: 'request_end',
      capability: 'image_generate',
      provider: result.provider,
      model: input.referenceImage
        ? config.siliconflowImageEditModel
        : config.siliconflowImageTextModel,
      durationMs: Date.now() - startedAt,
      statusCode: result.statusCode,
      requestId: result.requestId,
      summary: result.imageUrls[0],
    });

    return result;
  } catch (error) {
    const statusCode =
      error instanceof ProviderRequestError ? error.statusCode : undefined;

    logAiEvent('error', {
      event: 'request_error',
      capability: 'image_generate',
      provider: provider.name,
      model: input.referenceImage
        ? config.siliconflowImageEditModel
        : config.siliconflowImageTextModel,
      durationMs: Date.now() - startedAt,
      statusCode,
      summary: getErrorSummary(error),
    });

    throw error;
  }
}

export async function generateCharacterVideo(input: {
  prompt: string;
  duration?: number;
  ratio?: '16:9' | '9:16' | '1:1';
  resolution?: '480p' | '720p' | '1080p';
  firstFrameUrl?: string;
}): Promise<VideoGenerationResult> {
  const config = getAiConfig();
  const provider = getVideoProvider();
  const startedAt = Date.now();

  logAiEvent('info', {
    event: 'request_start',
    capability: 'video_generate',
    provider: provider.name,
    model: config.arkVideoModel,
  });

  try {
    const result = await provider.generateVideo({
      prompt: input.prompt,
      duration: input.duration,
      ratio: input.ratio,
      resolution: input.resolution,
      firstFrameUrl: input.firstFrameUrl,
      timeoutMs: config.videoTimeoutMs,
      pollIntervalMs: config.videoPollIntervalMs,
      maxPollAttempts: config.videoPollMaxAttempts,
    });

    logAiEvent('info', {
      event: 'request_end',
      capability: 'video_generate',
      provider: result.provider,
      model: config.arkVideoModel,
      durationMs: Date.now() - startedAt,
      statusCode: result.statusCode,
      requestId: result.requestId,
      summary: result.videoUrl,
    });

    return result;
  } catch (error) {
    const statusCode =
      error instanceof ProviderRequestError ? error.statusCode : undefined;

    logAiEvent('error', {
      event: 'request_error',
      capability: 'video_generate',
      provider: provider.name,
      model: config.arkVideoModel,
      durationMs: Date.now() - startedAt,
      statusCode,
      summary: getErrorSummary(error),
    });

    throw error;
  }
}

export async function submitCharacterVideo(input: {
  prompt: string;
  duration?: number;
  ratio?: '16:9' | '9:16' | '1:1';
  resolution?: '480p' | '720p' | '1080p';
  firstFrameUrl?: string;
}): Promise<VideoSubmitResult> {
  const config = getAiConfig();
  const provider = getVideoProvider();
  const startedAt = Date.now();

  logAiEvent('info', {
    event: 'request_start',
    capability: 'video_submit',
    provider: provider.name,
    model: config.arkVideoModel,
  });

  try {
    const result = await provider.submitVideo({
      prompt: input.prompt,
      duration: input.duration,
      ratio: input.ratio,
      resolution: input.resolution,
      firstFrameUrl: input.firstFrameUrl,
      timeoutMs: config.requestTimeoutMs,
    });

    logAiEvent('info', {
      event: 'request_end',
      capability: 'video_submit',
      provider: result.provider,
      model: config.arkVideoModel,
      durationMs: Date.now() - startedAt,
      statusCode: result.statusCode,
      requestId: result.requestId,
      summary: result.status,
    });

    return result;
  } catch (error) {
    const statusCode =
      error instanceof ProviderRequestError ? error.statusCode : undefined;

    logAiEvent('error', {
      event: 'request_error',
      capability: 'video_submit',
      provider: provider.name,
      model: config.arkVideoModel,
      durationMs: Date.now() - startedAt,
      statusCode,
      summary: getErrorSummary(error),
    });

    throw error;
  }
}

export async function getCharacterVideoStatus(input: {
  requestId: string;
}): Promise<VideoStatusResult> {
  const config = getAiConfig();
  const provider = getVideoProvider();
  const startedAt = Date.now();

  logAiEvent('info', {
    event: 'request_start',
    capability: 'video_status',
    provider: provider.name,
  });

  try {
    const result = await provider.getVideoStatus({
      requestId: input.requestId,
      timeoutMs: config.requestTimeoutMs,
    });

    logAiEvent('info', {
      event: 'request_end',
      capability: 'video_status',
      provider: result.provider,
      durationMs: Date.now() - startedAt,
      statusCode: result.statusCode,
      requestId: result.requestId,
      summary: result.status,
    });

    return result;
  } catch (error) {
    const statusCode =
      error instanceof ProviderRequestError ? error.statusCode : undefined;

    logAiEvent('error', {
      event: 'request_error',
      capability: 'video_status',
      provider: provider.name,
      durationMs: Date.now() - startedAt,
      statusCode,
      summary: getErrorSummary(error),
    });

    throw error;
  }
}
