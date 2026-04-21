export type MediaIntent = 'selfie' | 'dance' | 'workout';

const MEDIA_KEYWORDS: Record<MediaIntent, string[]> = {
  dance: [
    '跳舞视频', '跳舞的视频', '跳个舞视频', '跳舞给你看', '看你跳舞',
    '想看你跳', '给我跳舞', '跳一段舞', '来段舞', '来个舞蹈',
    '跳舞', '跳个舞', '跳舞吧', '舞一下', '秀一下舞', '舞步',
    '来跳舞', '一起跳舞', '跳支舞', '跳个舞给我', '给我跳',
    '舞蹈视频', '跳舞看', '看跳舞',
    '发个视频', '发段视频', '拍个视频', '录个视频', '发视频',
    '录视频', '拍视频', '来个视频', '来段视频', '看看视频', '视频给我看',
    '科目三', '小苹果', '广场舞', '女团舞', '宅舞', '街舞', '编舞',
    '极乐净土', '甩葱歌',
  ],
  workout: [
    '健身视频', '健身给你看', '看你健身', '看你运动', '运动视频',
    '健身', '运动', '锻炼', '健身房', '秀肌肉', '健身给你',
    '运动给我看', '健身看看', '锻炼视频', '运动的视频',
  ],
  selfie: [
    '自拍', '发张自拍', '发个自拍', '自拍看看', '自拍给我看',
    '照片', '发张照片', '发个照片', '照片看看', '你的照片',
    '看看你', '想看你', '晒一下', '晒晒', '发张照', '照片给我',
    '拍张照', '拍个照', '自拍吧', '来张自拍', '发个照',
    '你的自拍', '看照片', '看自拍', '发照片',
  ],
};

export function detectMediaIntent(userMessage: string): MediaIntent | null {
  const normalizedMessage = userMessage.toLowerCase();

  for (const keyword of MEDIA_KEYWORDS.dance) {
    if (normalizedMessage.includes(keyword)) {
      return 'dance';
    }
  }

  for (const keyword of MEDIA_KEYWORDS.workout) {
    if (normalizedMessage.includes(keyword)) {
      return 'workout';
    }
  }

  for (const keyword of MEDIA_KEYWORDS.selfie) {
    if (normalizedMessage.includes(keyword)) {
      return 'selfie';
    }
  }

  return null;
}
