import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { ExamOptions, ListeningItem, ReadingItem } from './types';
import { buildListeningSystemPrompt } from './prompts/listeningPrompt';
import { buildReadingSystemPrompt } from './prompts/readingPrompt';
import { GEMINI_MODEL } from './geminiConfig';
import type { GenerationUnit } from './generationUnits';

const MAX_ATTEMPTS = 3; // 최초 시도 + 최대 2회 재시도

function getClient(apiKey: string): GoogleGenAI {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API 키가 없습니다. 설정 화면에서 API 키를 먼저 입력해주세요.');
  }
  return new GoogleGenAI({ apiKey });
}

const choiceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    number: { type: Type.INTEGER },
    text: { type: Type.STRING },
  },
  required: ['number', 'text'],
};

const listeningItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    number: { type: Type.INTEGER },
    type: { type: Type.STRING },
    instruction: { type: Type.STRING },
    speakers: { type: Type.ARRAY, items: { type: Type.STRING, enum: ['M', 'W', 'Narrator'] } },
    script: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING, enum: ['M', 'W', 'Narrator'] },
          line: { type: Type.STRING },
        },
        required: ['speaker', 'line'],
      },
    },
    scriptKo: { type: Type.ARRAY, items: { type: Type.STRING } },
    choices: { type: Type.ARRAY, items: choiceSchema },
    answer: { type: Type.INTEGER },
    explanation: { type: Type.STRING },
    imageRef: { type: Type.STRING, nullable: true },
    pairGroupId: { type: Type.STRING, nullable: true },
  },
  required: [
    'number',
    'type',
    'instruction',
    'speakers',
    'script',
    'scriptKo',
    'choices',
    'answer',
    'explanation',
  ],
};

const readingTableSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    caption: { type: Type.STRING, nullable: true },
    headers: { type: Type.ARRAY, items: { type: Type.STRING } },
    rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
  },
  required: ['headers', 'rows'],
};

const readingItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    number: { type: Type.INTEGER },
    type: { type: Type.STRING },
    instruction: { type: Type.STRING },
    passage: { type: Type.STRING },
    passageKo: { type: Type.STRING },
    chartData: { ...readingTableSchema, nullable: true },
    choices: { type: Type.ARRAY, items: choiceSchema, nullable: true },
    // 40번(요약문 완성) 전용 — (A)/(B) 두 그룹만 와야 한다. minItems/maxItems로
    // Gemini가 그룹을 2개보다 많거나 적게 생성하지 않도록 명시(실사용 중 그룹을
    // 2개보다 많이 생성해 검증이 실패하는 경우가 있어 추가).
    pairChoices: {
      type: Type.ARRAY,
      nullable: true,
      minItems: '2',
      maxItems: '2',
      items: { type: Type.ARRAY, items: choiceSchema },
    },
    answer: { type: Type.STRING },
    explanation: { type: Type.STRING },
    keyVocab: {
      type: Type.ARRAY,
      nullable: true,
      items: {
        type: Type.OBJECT,
        properties: { word: { type: Type.STRING }, meaning: { type: Type.STRING } },
        required: ['word', 'meaning'],
      },
    },
    imageRef: { type: Type.STRING, nullable: true },
    summary: { type: Type.STRING, nullable: true },
    pairGroupId: { type: Type.STRING, nullable: true },
  },
  required: ['number', 'type', 'instruction', 'passage', 'passageKo', 'answer', 'explanation'],
};

const listeningResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: { type: Type.ARRAY, items: listeningItemSchema },
  },
  required: ['items'],
};

const readingResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: { type: Type.ARRAY, items: readingItemSchema },
  },
  required: ['items'],
};

const choiceZod = z.object({ number: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]), text: z.string() });

const listeningItemZod = z
  .object({
    number: z.number(),
    type: z.string(),
    instruction: z.string(),
    speakers: z.array(z.enum(['M', 'W', 'Narrator'])),
    script: z.array(z.object({ speaker: z.enum(['M', 'W', 'Narrator']), line: z.string() })),
    scriptKo: z.array(z.string()),
    choices: z.array(choiceZod),
    answer: z.number(),
    explanation: z.string(),
    imageRef: z.string().nullable().optional(),
    pairGroupId: z.string().nullable().optional(),
  })
  .refine((item) => item.script.length === item.scriptKo.length, {
    message: 'scriptKo 배열의 길이가 script 배열과 일치해야 합니다.',
  });

const readingTableZod = z.object({
  caption: z.string().nullable().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const readingItemRawZod = z.object({
  number: z.number(),
  type: z.string(),
  instruction: z.string(),
  passage: z.string(),
  passageKo: z.string(),
  chartData: readingTableZod.nullable().optional(),
  choices: z.array(choiceZod).nullable().optional(),
  // 엄격한 2-튜플로 강제하면 Gemini가 그룹을 2개보다 많이(또는 적게) 주는 경우
  // 파싱 자체가 실패해 배치 전체(17~11문항)가 통째로 재시도되는 문제가 있었다
  // (실사용 중 "too_big" 에러로 발견). 파싱 단계에서는 느슨하게 배열의 배열로만
  // 받고, 실제로 40번 문항에만 의미 있게 쓰이도록 하는 판단은
  // normalizeReadingItem에서 number === 40 기준으로 처리한다.
  pairChoices: z.array(z.array(choiceZod)).nullable().optional(),
  answer: z.union([z.number(), z.string()]),
  explanation: z.string(),
  keyVocab: z.array(z.object({ word: z.string(), meaning: z.string() })).nullable().optional(),
  imageRef: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  pairGroupId: z.string().nullable().optional(),
});

async function callGeminiJson<T>(
  client: GoogleGenAI,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: Schema,
  parseAndValidate: (raw: unknown) => T,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let text: string | undefined;
    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      text = response.text;
      if (!text) throw new Error('Gemini 응답에 텍스트가 없습니다.');

      const raw = JSON.parse(text);
      return parseAndValidate(raw);
    } catch (err) {
      lastError = err;
      console.warn(`[gemini] 시도 ${attempt}/${MAX_ATTEMPTS} 실패:`, err instanceof Error ? err.message : err);
      // 검증 실패의 원인을 바로 파악할 수 있도록 Gemini가 실제로 응답한 원본 JSON을 그대로 남긴다
      // (JSON 파싱 자체가 실패한 경우엔 text가 없을 수 있음).
      if (text) {
        console.warn(`[gemini] 시도 ${attempt}/${MAX_ATTEMPTS} 원본 응답:`, text);
      }
    }
  }

  throw new Error(`Gemini 호출이 ${MAX_ATTEMPTS}회 모두 실패했습니다: ${lastError instanceof Error ? lastError.message : lastError}`);
}

const SUMMARY_ITEM_NUMBER = 40; // 요약문 완성(pairChoices 사용) 문항 번호 — 이 번호가 아니면 pairChoices는 무시한다.

function normalizeReadingItem(raw: z.infer<typeof readingItemRawZod>): ReadingItem {
  let choices: ReadingItem['choices'];

  if (raw.number === SUMMARY_ITEM_NUMBER) {
    const groups = raw.pairChoices ?? [];
    if (groups.length !== 2) {
      console.warn(
        `[gemini] ${SUMMARY_ITEM_NUMBER}번 pairChoices 그룹 개수가 2가 아닙니다 (받은 개수: ${groups.length}).`,
      );
    }
    if (groups.length < 2) {
      throw new Error(
        `${SUMMARY_ITEM_NUMBER}번 문항의 pairChoices가 올바르지 않습니다 (받은 그룹 수: ${groups.length}).`,
      );
    }
    choices = { pairChoices: [groups[0], groups[1]] };
  } else {
    // 40번이 아닌 문항은 pairChoices를 절대 쓰지 않는다 — Gemini가 실수로 값을 채워도 무시.
    choices = raw.choices ?? [];
  }

  return {
    number: raw.number,
    type: raw.type,
    instruction: raw.instruction,
    passage: raw.passage,
    passageKo: raw.passageKo,
    chartData: raw.chartData
      ? { ...raw.chartData, caption: raw.chartData.caption ?? undefined }
      : undefined,
    choices,
    answer: raw.answer,
    explanation: raw.explanation,
    keyVocab: raw.keyVocab ?? undefined,
    imageRef: raw.imageRef ?? undefined,
    summary: raw.summary ?? undefined,
    pairGroupId: raw.pairGroupId ?? undefined,
  };
}

function validateUnitNumbers(items: { number: number }[], expectedNumbers: number[], label: string): void {
  if (items.length !== expectedNumbers.length) {
    throw new Error(`${label} 문항 개수가 ${expectedNumbers.length}개가 아닙니다 (받은 개수: ${items.length})`);
  }
  const received = new Set(items.map((item) => item.number));
  const missing = expectedNumbers.filter((n) => !received.has(n));
  if (missing.length > 0) {
    throw new Error(`${label} 문항 번호가 요청과 일치하지 않습니다 (누락: ${missing.join(', ')})`);
  }
}

// 설계스펙 v2 — 문항별 개별 생성. unit은 문항 하나(단일 번호) 또는 짝 그룹(16-17/41-42/
// 43-45, generationUnits.ts가 구성)이며, 항상 하나의 Gemini 호출로 unit.numbers 전체를
// 함께 생성한다. usedTopics는 독해 문항에서만 의미 있음(같은 생성 세션 내 다른 독해
// 지문과 소재가 겹치지 않도록 지금까지 생성된 독해 문항들의 소재 요약을 누적 전달).
export async function generateItemUnit(
  apiKey: string,
  options: ExamOptions,
  unit: GenerationUnit,
  usedTopics: string[] = [],
): Promise<(ListeningItem | ReadingItem)[]> {
  const client = getClient(apiKey);

  if (unit.kind === 'listening') {
    const systemInstruction = buildListeningSystemPrompt(options, unit.numbers);
    return callGeminiJson(
      client,
      systemInstruction,
      `${unit.numbers.join(', ')}번 문항을 생성하라.`,
      listeningResponseSchema,
      (raw) => {
        const parsed = z.object({ items: z.array(listeningItemZod) }).parse(raw);
        validateUnitNumbers(parsed.items, unit.numbers, '듣기');
        return parsed.items as ListeningItem[];
      },
    );
  }

  const systemInstruction = buildReadingSystemPrompt(options, unit.numbers, usedTopics);
  return callGeminiJson(
    client,
    systemInstruction,
    `${unit.numbers.join(', ')}번 문항을 생성하라.`,
    readingResponseSchema,
    (raw) => {
      const parsed = z.object({ items: z.array(readingItemRawZod) }).parse(raw);
      validateUnitNumbers(parsed.items, unit.numbers, '독해');
      return parsed.items.map(normalizeReadingItem);
    },
  );
}

// 독해 문항의 소재가 다른 독해 문항과 겹치지 않도록, 지금까지 생성된 독해 문항들의 소재를
// 짧게 요약해 다음 유닛의 프롬프트에 "이미 사용한 소재" 목록으로 전달할 때 사용한다.
export function extractTopics(reading: ReadingItem[]): string[] {
  return reading.map((item) => `${item.number}번(${item.type}): ${item.passage.slice(0, 40)}...`);
}
