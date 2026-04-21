import {
  CHOREOGRAPHY_PRIORITY_VIDEO_OPTIONS,
  CharacterVideoOptions,
  DEFAULT_CHARACTER_VIDEO_OPTIONS,
} from '@/lib/video-presets';

export type RequestedVideoKind = 'dance' | 'workout';

const DANCE_REQUEST_KEYWORDS = [
  '跳舞',
  '跳个舞',
  '跳支舞',
  '跳一段舞',
  '来段舞',
  '来个舞蹈',
  '给我跳',
  '舞蹈',
  '跳',
  '舞',
];

const DANCE_SPECIFIC_STYLE_KEYWORDS = [
  '小苹果',
  '科目三',
  '爱你',
  '极乐净土',
  '甩葱歌',
  '广场舞',
  '女团舞',
  '宅舞',
  '街舞',
  '编舞',
];

const DANCE_CHOREOGRAPHY_PRIORITY_KEYWORDS = [
  '小苹果',
  '科目三',
  '爱你',
  '极乐净土',
  '甩葱歌',
  '广场舞',
  '女团舞',
  '宅舞',
  '街舞',
  '编舞',
];

const WORKOUT_DETAIL_KEYWORDS = [
  '健身',
  '运动',
  '锻炼',
  '撸铁',
  '练胸',
  '练腿',
  '练背',
  '深蹲',
  '卧推',
  '俯卧撑',
  '引体向上',
  '卷腹',
  '跑步',
  '有氧',
  '器械',
];

const DANCE_STYLE_HINTS = [
  {
    keyword: '小苹果',
    hint:
      '舞蹈参考《小苹果》的流行广场舞风格，动作热情明快，包含标志性的摆臂、扭胯、左右踏步和整齐重复的节奏动作。',
  },
  {
    keyword: '科目三',
    hint:
      '舞蹈参考“科目三”网络热舞风格，步伐连续，摆手动作明显，整体节奏感强，动作要连贯洗脑。',
  },
];

export interface RequestedVideoPlan {
  prompt: string;
  options: CharacterVideoOptions;
  useReferenceImage: boolean;
}

function isSpecificRequest(kind: RequestedVideoKind, userRequest: string): boolean {
  const normalizedRequest = userRequest.trim().toLowerCase();

  if (!normalizedRequest) {
    return false;
  }

  const keywords =
    kind === 'dance' ? DANCE_SPECIFIC_STYLE_KEYWORDS : WORKOUT_DETAIL_KEYWORDS;

  return keywords.some(keyword => normalizedRequest.includes(keyword));
}

function shouldPrioritizeDanceChoreography(userRequest: string): boolean {
  return DANCE_CHOREOGRAPHY_PRIORITY_KEYWORDS.some(keyword =>
    userRequest.includes(keyword),
  );
}

function getDanceStyleHint(userRequest: string): string | undefined {
  return DANCE_STYLE_HINTS.find(style => userRequest.includes(style.keyword))?.hint;
}

export function buildRequestedVideoPrompt(input: {
  kind: RequestedVideoKind;
  basePrompt: string;
  userRequest?: string;
  choreographyPriority?: boolean;
}): string {
  const basePrompt = input.basePrompt.trim();
  const userRequest = input.userRequest?.trim();

  if (!userRequest) {
    return basePrompt;
  }

  if (input.kind === 'dance' && !DANCE_REQUEST_KEYWORDS.some(keyword => userRequest.includes(keyword))) {
    return basePrompt;
  }

  if (!isSpecificRequest(input.kind, userRequest)) {
    return basePrompt;
  }

  if (input.kind === 'dance' && input.choreographyPriority) {
    const danceStyleHint = getDanceStyleHint(userRequest);
    const segments = [
      `这次是明确的特定舞蹈请求：${userRequest}。请严格优先满足这次的编舞要求，先还原该舞蹈的标志性动作、步伐节奏和整体风格。`,
      danceStyleHint,
      '不要泛化成普通跳舞视频，不要只做简单摆手、随意扭动或敷衍性的通用舞蹈动作。',
      `${basePrompt} 人物设定只作为外观、年龄气质和场景参考，动作编排必须优先满足具体舞蹈要求。`,
    ];

    return segments.filter(Boolean).join(' ');
  }

  const segments = [
    basePrompt,
    `请严格满足这次的具体请求：${userRequest}。`,
  ];

  if (input.kind === 'dance') {
    const danceStyleHint = getDanceStyleHint(userRequest);
    if (danceStyleHint) {
      segments.push(danceStyleHint);
    }

    segments.push('动作要完整清晰，有明显节奏感和编排感，不要只做泛化的简单摆动。');
  } else {
    segments.push('动作要贴合用户提到的训练项目，展示完整动作和发力感，不要只做泛化的站立摆拍。');
  }

  return segments.join(' ');
}

export function resolveRequestedVideoPlan(input: {
  kind: RequestedVideoKind;
  basePrompt: string;
  userRequest?: string;
}): RequestedVideoPlan {
  const userRequest = input.userRequest?.trim();
  const choreographyPriority = Boolean(
    input.kind === 'dance' &&
      userRequest &&
      shouldPrioritizeDanceChoreography(userRequest),
  );

  return {
    prompt: buildRequestedVideoPrompt({
      ...input,
      choreographyPriority,
    }),
    options: choreographyPriority
      ? CHOREOGRAPHY_PRIORITY_VIDEO_OPTIONS
      : DEFAULT_CHARACTER_VIDEO_OPTIONS,
    useReferenceImage: choreographyPriority ? false : true,
  };
}
