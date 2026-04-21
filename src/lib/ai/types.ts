export type AiProviderName = 'volcengine' | 'siliconflow';

export type TextProviderName = 'volcengine';
export type SpeechProviderName = 'siliconflow';
export type ImageProviderName = 'siliconflow';
export type VideoProviderName = 'volcengine';

export type MessageRole = 'system' | 'user' | 'assistant';

export type MessageContentPart =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image_url';
      url: string;
      detail?: 'high' | 'low';
    }
  | {
      type: 'video_url';
      url: string;
      fps?: number | null;
    };

export interface ProviderMessage {
  role: MessageRole;
  content: string | MessageContentPart[];
}

export interface UsageMetrics {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
}

export interface TextGenerationRequest {
  messages: ProviderMessage[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface TextGenerationResult {
  provider: TextProviderName;
  model: string;
  text: string;
  statusCode?: number;
  requestId?: string;
  usage?: UsageMetrics;
  raw?: unknown;
}

export interface SpeechSynthesisRequest {
  text: string;
  voiceId: string;
  uid: string;
  audioFormat?: 'mp3' | 'pcm' | 'ogg_opus';
  sampleRate?: number;
  timeoutMs?: number;
}

export interface SpeechSynthesisResult {
  provider: SpeechProviderName;
  audioUrl: string;
  audioSize: number;
  contentType: string;
  statusCode?: number;
  requestId?: string;
  raw?: unknown;
}

export interface SpeechTranscriptionRequest {
  audioBase64: string;
  timeoutMs?: number;
}

export interface SpeechTranscriptionResult {
  provider: SpeechProviderName;
  text: string;
  duration?: number;
  statusCode?: number;
  requestId?: string;
  raw?: unknown;
}

export interface ImageGenerationRequest {
  prompt: string;
  referenceImage?: string;
  imageSize?: string;
  timeoutMs?: number;
}

export interface ImageGenerationResult {
  provider: ImageProviderName;
  imageUrls: string[];
  seed?: number;
  statusCode?: number;
  requestId?: string;
  raw?: unknown;
}

export interface VideoGenerationRequest {
  prompt: string;
  duration?: number;
  ratio?: '16:9' | '9:16' | '1:1';
  resolution?: '480p' | '720p' | '1080p';
  firstFrameUrl?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export type VideoGenerationStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface VideoSubmitResult {
  provider: VideoProviderName;
  requestId: string;
  status: 'queued';
  statusCode?: number;
  raw?: unknown;
}

export interface VideoStatusRequest {
  requestId: string;
  timeoutMs?: number;
}

export interface VideoStatusResult {
  provider: VideoProviderName;
  requestId: string;
  status: VideoGenerationStatus;
  videoUrl?: string;
  reason?: string;
  statusCode?: number;
  raw?: unknown;
}

export interface VideoGenerationResult {
  provider: VideoProviderName;
  videoUrl: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  statusCode?: number;
  requestId?: string;
  raw?: unknown;
}

export interface TextGenerationProvider {
  readonly name: TextProviderName;
  isAvailable(): boolean;
  generateText(input: TextGenerationRequest): Promise<TextGenerationResult>;
}

export interface SpeechProvider {
  readonly name: SpeechProviderName;
  isAvailable(): boolean;
  synthesizeSpeech(input: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>;
  transcribeSpeech(input: SpeechTranscriptionRequest): Promise<SpeechTranscriptionResult>;
}

export interface ImageGenerationProvider {
  readonly name: ImageProviderName;
  isAvailable(): boolean;
  generateImage(input: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface VideoGenerationProvider {
  readonly name: VideoProviderName;
  isAvailable(): boolean;
  submitVideo(input: VideoGenerationRequest): Promise<VideoSubmitResult>;
  getVideoStatus(input: VideoStatusRequest): Promise<VideoStatusResult>;
  generateVideo(input: VideoGenerationRequest): Promise<VideoGenerationResult>;
}
