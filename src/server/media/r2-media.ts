import { uploadToR2 } from '@/lib/r2';
import { parseBase64AudioPayload } from '@/lib/ai/utils/media';

type AssetDirectory = 'images' | 'videos' | 'audio';

type DownloadedAsset = {
  buffer: Buffer;
  contentType: string;
  extension: string;
};

function normalizeContentType(
  value: string | null | undefined,
  fallback: string,
) {
  return value?.split(';')[0]?.trim().toLowerCase() || fallback;
}

function extensionFromContentType(contentType: string): string | null {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/png':
      return 'png';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/webm':
      return 'webm';
    default:
      return null;
  }
}

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').pop() || '';
    const matched = lastSegment.match(/\.([a-zA-Z0-9]+)$/);
    return matched ? matched[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function resolveExtension(
  contentType: string,
  sourceUrl: string,
  fallback: string,
) {
  return (
    extensionFromContentType(contentType) ||
    extensionFromUrl(sourceUrl) ||
    fallback
  );
}

export async function downloadRemoteAsset(
  url: string,
  fallbackContentType: string,
): Promise<DownloadedAsset> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('下载 AI 生成文件失败');
  }

  const contentType = normalizeContentType(
    response.headers.get('content-type'),
    fallbackContentType,
  );

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
    extension: resolveExtension(contentType, url, 'bin'),
  };
}

export async function uploadAssetToR2(input: {
  userId: string;
  directory: AssetDirectory;
  buffer: Buffer;
  contentType: string;
  extension: string;
}) {
  const fileName = `${input.directory}/${input.userId}/${Date.now()}-${crypto.randomUUID()}.${input.extension}`;
  return uploadToR2(input.buffer, fileName, input.contentType);
}

export async function persistRemoteAssetToR2(input: {
  userId: string;
  sourceUrl: string;
  directory: AssetDirectory;
  fallbackContentType: string;
}) {
  const downloaded = await downloadRemoteAsset(
    input.sourceUrl,
    input.fallbackContentType,
  );

  return uploadAssetToR2({
    userId: input.userId,
    directory: input.directory,
    buffer: downloaded.buffer,
    contentType: downloaded.contentType,
    extension: downloaded.extension,
  });
}

export async function persistGeneratedAudioToR2(input: {
  userId: string;
  audioUrl: string;
}) {
  if (/^data:/i.test(input.audioUrl.trim())) {
    const parsed = parseBase64AudioPayload(input.audioUrl);

    return uploadAssetToR2({
      userId: input.userId,
      directory: 'audio',
      buffer: parsed.bytes,
      contentType: parsed.contentType,
      extension: parsed.extension,
    });
  }

  return persistRemoteAssetToR2({
    userId: input.userId,
    sourceUrl: input.audioUrl,
    directory: 'audio',
    fallbackContentType: 'audio/mpeg',
  });
}
