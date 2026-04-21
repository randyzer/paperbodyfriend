import { generateGameText } from '@/lib/ai/services/game-ai-service';

type LoveLetterInput = {
  userName: string;
  characterId?: string;
};

type LoveLetterServiceDeps = {
  generateText(input: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string>;
};

const LOVE_LETTER_STYLE_PROMPTS: Record<string, string> = {
  uncle:
    '你要用沉稳、成熟、克制但温柔的语气写一句早安情话，像一个可靠的大叔在轻声关心她。',
  sunshine:
    '你要用阳光、热情、轻快、带点俏皮的语气写一句早安情话，像一个活力满满的男孩在想念她。',
  straight_man:
    '你要用真诚、略带笨拙、朴实但很让人安心的语气写一句早安情话，像一个不善表达却很在乎她的人。',
  default:
    '你要用温柔、自然、亲近的语气写一句早安情话，让人感到被惦记和被陪伴。',
};

function buildLoveLetterSystemPrompt(characterId?: string) {
  const stylePrompt =
    (characterId && LOVE_LETTER_STYLE_PROMPTS[characterId]) ||
    LOVE_LETTER_STYLE_PROMPTS.default;

  return `
你正在为“纸片人男友”生成每日早安邮件里的情话内容。

${stylePrompt}

要求：
- 只输出 1 段中文正文，不要标题，不要署名，不要 markdown
- 长度控制在 30 到 80 字之间
- 内容要像真人写给恋人的早安问候，避免夸张和油腻
- 可以轻微个性化地称呼对方，但不要编造不存在的信息
`.trim();
}

function buildLoveLetterUserPrompt(userName: string) {
  return `请给 ${userName} 写一段今天早上的情话邮件正文。`;
}

export function createLoveLetterService(
  deps: LoveLetterServiceDeps = {
    async generateText(input) {
      const result = await generateGameText({
        capability: 'game_chat',
        systemPrompt: input.systemPrompt,
        messages: [
          {
            role: 'user',
            content: input.userPrompt,
          },
        ],
      });

      return result.text;
    },
  },
) {
  return {
    async generateLoveLetter(input: LoveLetterInput) {
      const text = await deps.generateText({
        systemPrompt: buildLoveLetterSystemPrompt(input.characterId),
        userPrompt: buildLoveLetterUserPrompt(input.userName),
      });

      return text.trim();
    },
  };
}

const defaultLoveLetterService = createLoveLetterService();

export async function generateLoveLetter(input: LoveLetterInput) {
  return defaultLoveLetterService.generateLoveLetter(input);
}
