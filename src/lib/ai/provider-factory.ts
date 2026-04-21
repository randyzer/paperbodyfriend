import { SiliconFlowImageProvider } from '@/lib/ai/providers/siliconflow/image-provider';
import { SiliconFlowSpeechProvider } from '@/lib/ai/providers/siliconflow/speech-provider';
import { VolcengineArkResponsesProvider } from '@/lib/ai/providers/volcengine/ark-responses-provider';
import { VolcengineArkVideoProvider } from '@/lib/ai/providers/volcengine/ark-video-provider';
import {
  ImageGenerationProvider,
  SpeechProvider,
  TextGenerationProvider,
  VideoGenerationProvider,
} from '@/lib/ai/types';

const textProvider = new VolcengineArkResponsesProvider();
const speechProvider = new SiliconFlowSpeechProvider();
const imageProvider = new SiliconFlowImageProvider();
const videoProvider = new VolcengineArkVideoProvider();

export function getTextProvider(): TextGenerationProvider {
  return textProvider;
}

export function getSpeechProvider(): SpeechProvider {
  return speechProvider;
}

export function getImageProvider(): ImageGenerationProvider {
  return imageProvider;
}

export function getVideoProvider(): VideoGenerationProvider {
  return videoProvider;
}
