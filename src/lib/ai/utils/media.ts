import { Buffer } from 'node:buffer';

import { getAiConfig } from '@/lib/ai/config';

export interface ParsedBase64AudioPayload {
  bytes: Buffer;
  contentType: string;
  extension: string;
}

export function contentTypeToExtension(contentType: string): string {
  if (contentType.includes('wav')) {
    return 'wav';
  }

  if (contentType.includes('ogg') || contentType.includes('opus')) {
    return 'ogg';
  }

  if (contentType.includes('pcm')) {
    return 'pcm';
  }

  return 'mp3';
}

export function parseBase64AudioPayload(base64Data: string): ParsedBase64AudioPayload {
  const trimmed = base64Data.trim();
  const matched = trimmed.match(/^data:([^;]+);base64,(.+)$/);

  if (matched) {
    const [, contentType, payload] = matched;

    return {
      bytes: Buffer.from(payload, 'base64'),
      contentType,
      extension: contentTypeToExtension(contentType),
    };
  }

  return {
    bytes: Buffer.from(trimmed, 'base64'),
    contentType: 'audio/mpeg',
    extension: 'mp3',
  };
}

export function resolveAudioContentType(
  responseFormat: 'mp3' | 'pcm' | 'opus',
  headerContentType?: string | null,
): string {
  if (headerContentType && headerContentType.startsWith('audio/')) {
    return headerContentType;
  }

  if (responseFormat === 'opus') {
    return 'audio/ogg';
  }

  if (responseFormat === 'pcm') {
    return 'audio/pcm';
  }

  return 'audio/mpeg';
}

export function normalizeSiliconFlowVoice(voiceName: string, model: string): string {
  if (voiceName.includes(':')) {
    return voiceName;
  }

  return `${model}:${voiceName}`;
}

export function normalizeTtsInputText(text: string): string {
  const normalized = text
    .trim()
    .replace(/\[MEDIA:[^\]]+\]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[~～]+/g, '。')
    .replace(/\.{2,}|…+/g, '。')
    .replace(/[*_#`<>[\]{}()]/g, ' ')
    .replace(/([，,]){2,}/g, '，')
    .replace(/([。！？]){2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || text.trim();
}

export function resolveCharacterVoice(characterId?: string): string {
  const config = getAiConfig();

  return normalizeSiliconFlowVoice(
    config.siliconflowTtsDefaultVoice,
    config.siliconflowTtsModel,
  );
}

export function resolveVideoImageSize(
  ratio: '16:9' | '9:16' | '1:1' = '16:9',
  resolution: '480p' | '720p' | '1080p' = '720p',
): string {
  if (ratio === '16:9') {
    if (resolution === '480p') {
      return '854x480';
    }

    if (resolution === '1080p') {
      return '1920x1080';
    }

    return '1280x720';
  }

  if (ratio === '9:16') {
    if (resolution === '480p') {
      return '480x854';
    }

    if (resolution === '1080p') {
      return '1080x1920';
    }

    return '720x1280';
  }

  if (resolution === '480p') {
    return '480x480';
  }

  if (resolution === '1080p') {
    return '1080x1080';
  }

  return '720x720';
}
