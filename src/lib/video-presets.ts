export interface CharacterVideoOptions {
  duration: number;
  ratio: '16:9' | '9:16' | '1:1';
  resolution: '480p' | '720p' | '1080p';
}

export const DEFAULT_CHARACTER_VIDEO_OPTIONS: CharacterVideoOptions = {
  duration: 3,
  ratio: '16:9',
  resolution: '480p',
};

export const CHOREOGRAPHY_PRIORITY_VIDEO_OPTIONS: CharacterVideoOptions = {
  duration: 4,
  ratio: '16:9',
  resolution: '480p',
};
