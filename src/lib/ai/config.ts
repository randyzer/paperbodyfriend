export interface AiConfig {
  requestTimeoutMs: number;
  chatTimeoutMs: number;
  speechTimeoutMs: number;
  imageTimeoutMs: number;
  videoTimeoutMs: number;
  videoPollIntervalMs: number;
  videoPollMaxAttempts: number;
  chatMaxOutputTokens: number;
  arkApiKey?: string;
  arkBaseUrl: string;
  arkChatModel: string;
  arkVideoBaseUrl: string;
  arkVideoModel: string;
  arkVideoGenerateAudio: boolean;
  arkVideoWatermark: boolean;
  arkVideoDraft: boolean;
  arkVideoReturnLastFrame: boolean;
  arkVideoCameraFixed: boolean;
  siliconflowApiKey?: string;
  siliconflowTtsUrl: string;
  siliconflowTtsModel: string;
  siliconflowTtsDefaultVoice: string;
  siliconflowTtsVoiceUncle: string;
  siliconflowTtsVoiceSunshine: string;
  siliconflowTtsVoiceStraightMan: string;
  siliconflowTtsStream: boolean;
  siliconflowAsrUrl: string;
  siliconflowAsrModel: string;
  siliconflowImageUrl: string;
  siliconflowImageTextModel: string;
  siliconflowImageEditModel: string;
  siliconflowImageSize: string;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
}

let cachedConfig: AiConfig | null = null;

export function getAiConfig(): AiConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const requestTimeoutMs = parseNumber(process.env.AI_REQUEST_TIMEOUT_MS, 20_000);

  cachedConfig = {
    requestTimeoutMs,
    chatTimeoutMs: parseNumber(process.env.AI_CHAT_TIMEOUT_MS, 60_000),
    speechTimeoutMs: parseNumber(process.env.AI_SPEECH_TIMEOUT_MS, 45_000),
    imageTimeoutMs: parseNumber(process.env.AI_IMAGE_TIMEOUT_MS, 90_000),
    videoTimeoutMs: parseNumber(process.env.AI_VIDEO_TIMEOUT_MS, 300_000),
    videoPollIntervalMs: parseNumber(process.env.AI_VIDEO_POLL_INTERVAL_MS, 5_000),
    videoPollMaxAttempts: parseNumber(process.env.AI_VIDEO_POLL_MAX_ATTEMPTS, 60),
    chatMaxOutputTokens: parseNumber(process.env.AI_CHAT_MAX_OUTPUT_TOKENS, 1024),
    arkApiKey: process.env.ARK_API_KEY,
    arkBaseUrl:
      process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    arkChatModel:
      process.env.ARK_CHAT_MODEL || 'doubao-seed-2-0-pro-260215',
    arkVideoBaseUrl:
      process.env.ARK_VIDEO_BASE_URL ||
      process.env.ARK_BASE_URL ||
      'https://ark.cn-beijing.volces.com/api/v3',
    arkVideoModel:
      process.env.ARK_VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215',
    arkVideoGenerateAudio: parseBoolean(process.env.ARK_VIDEO_GENERATE_AUDIO, true),
    arkVideoWatermark: parseBoolean(process.env.ARK_VIDEO_WATERMARK, true),
    arkVideoDraft: parseBoolean(process.env.ARK_VIDEO_DRAFT, false),
    arkVideoReturnLastFrame: parseBoolean(process.env.ARK_VIDEO_RETURN_LAST_FRAME, false),
    arkVideoCameraFixed: parseBoolean(process.env.ARK_VIDEO_CAMERA_FIXED, false),
    siliconflowApiKey: process.env.SILICONFLOW_API_KEY,
    siliconflowTtsUrl:
      process.env.SILICONFLOW_TTS_URL || 'https://api.siliconflow.cn/v1/audio/speech',
    siliconflowTtsModel:
      process.env.SILICONFLOW_TTS_MODEL || 'FunAudioLLM/CosyVoice2-0.5B',
    siliconflowTtsDefaultVoice:
      process.env.SILICONFLOW_TTS_DEFAULT_VOICE || 'FunAudioLLM/CosyVoice2-0.5B:alex',
    siliconflowTtsVoiceUncle:
      process.env.SILICONFLOW_TTS_VOICE_UNCLE ||
      process.env.SILICONFLOW_TTS_DEFAULT_VOICE ||
      'FunAudioLLM/CosyVoice2-0.5B:alex',
    siliconflowTtsVoiceSunshine:
      process.env.SILICONFLOW_TTS_VOICE_SUNSHINE ||
      process.env.SILICONFLOW_TTS_DEFAULT_VOICE ||
      'FunAudioLLM/CosyVoice2-0.5B:alex',
    siliconflowTtsVoiceStraightMan:
      process.env.SILICONFLOW_TTS_VOICE_STRAIGHT_MAN ||
      process.env.SILICONFLOW_TTS_DEFAULT_VOICE ||
      'FunAudioLLM/CosyVoice2-0.5B:alex',
    siliconflowTtsStream: parseBoolean(process.env.SILICONFLOW_TTS_STREAM, true),
    siliconflowAsrUrl:
      process.env.SILICONFLOW_ASR_URL ||
      'https://api.siliconflow.cn/v1/audio/transcriptions',
    siliconflowAsrModel:
      process.env.SILICONFLOW_ASR_MODEL || 'FunAudioLLM/SenseVoiceSmall',
    siliconflowImageUrl:
      process.env.SILICONFLOW_IMAGE_URL ||
      'https://api.siliconflow.cn/v1/images/generations',
    siliconflowImageTextModel:
      process.env.SILICONFLOW_IMAGE_TEXT_MODEL || 'Kwai-Kolors/Kolors',
    siliconflowImageEditModel:
      process.env.SILICONFLOW_IMAGE_EDIT_MODEL || 'Qwen/Qwen-Image-Edit',
    siliconflowImageSize:
      process.env.SILICONFLOW_IMAGE_SIZE || '1024x1024',
  };

  return cachedConfig;
}

export function resetAiConfigForTests() {
  cachedConfig = null;
}

export function isArkConfigured(config = getAiConfig()): boolean {
  return Boolean(config.arkApiKey);
}

export function isSiliconFlowConfigured(config = getAiConfig()): boolean {
  return Boolean(config.siliconflowApiKey);
}
