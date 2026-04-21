import type { ChatMessage } from '@/lib/storage';

export type VideoJobKind = 'dance' | 'workout';

export const CLIENT_VIDEO_POLL_INTERVAL_MS = 10_000;
export const CLIENT_VIDEO_POLL_MAX_ATTEMPTS = 180;

export function isPendingVideoMessage(
  message: ChatMessage,
): message is ChatMessage & {
  videoStatus: 'pending';
  videoRequestId: string;
  pendingCaption: string;
  mediaKind: VideoJobKind;
} {
  return (
    message.videoStatus === 'pending' &&
    typeof message.videoRequestId === 'string' &&
    message.videoRequestId.length > 0 &&
    typeof message.pendingCaption === 'string' &&
    message.pendingCaption.length > 0 &&
    (message.mediaKind === 'dance' || message.mediaKind === 'workout')
  );
}

export function getPendingVideoMessage(kind: VideoJobKind): string {
  return kind === 'dance'
    ? '在给你准备视频，等我一下...'
    : '在给你准备运动视频，等我一下...';
}

export function getQueuedVideoMessage(kind: VideoJobKind): string {
  return kind === 'dance'
    ? '视频还在排队中，等有结果我再发你'
    : '运动视频还在排队中，等有结果我再发你';
}

export function getFailedVideoMessage(kind: VideoJobKind): string {
  return kind === 'dance'
    ? '视频生成失败了，稍后再试一次吧'
    : '运动视频生成失败了，稍后再试一次吧';
}
