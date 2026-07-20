import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { ExamOptions, ExamSet, ListeningItem, ReadingItem } from './types';
import { buildListeningSystemPrompt } from './prompts/listeningPrompt';
import { buildReadingSystemPrompt, type ReadingRange } from './prompts/readingPrompt';
import { GEMINI_MODEL } from './geminiConfig';

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
    pairChoices: {
      type: Type.ARRAY,
      nullable: true,
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
  pairChoices: z.tuple([z.array(choiceZod), z.array(choiceZod)]).nullable().optional(),
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

      const text = response.text;
      if (!text) throw new Error('Gemini 응답에 텍스트가 없습니다.');

      const raw = JSON.parse(text);
      return parseAndValidate(raw);
    } catch (err) {
      lastError = err;
      console.warn(`[gemini] 시도 ${attempt}/${MAX_ATTEMPTS} 실패:`, err instanceof Error ? err.message : err);
    }
  }

  throw new Error(`Gemini 호출이 ${MAX_ATTEMPTS}회 모두 실패했습니다: ${lastError instanceof Error ? lastError.message : lastError}`);
}

function normalizeReadingItem(raw: z.infer<typeof readingItemRawZod>): ReadingItem {
  const choices = raw.pairChoices
    ? { pairChoices: raw.pairChoices as [typeof raw.pairChoices[0], typeof raw.pairChoices[1]] }
    : (raw.choices ?? []);

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

export async function generateListening(apiKey: string, options: ExamOptions): Promise<ListeningItem[]> {
  const client = getClient(apiKey);
  const systemInstruction = buildListeningSystemPrompt(options);

  return callGeminiJson(
    client,
    systemInstruction,
    '듣기 1~17번 문항을 생성하라.',
    listeningResponseSchema,
    (raw) => {
      const parsed = z.object({ items: z.array(listeningItemZod) }).parse(raw);
      if (parsed.items.length !== 17) {
        throw new Error(`듣기 문항 개수가 17개가 아닙니다 (받은 개수: ${parsed.items.length})`);
      }
      return parsed.items as ListeningItem[];
    },
  );
}

export async function generateReading(
  apiKey: string,
  options: ExamOptions,
  range: ReadingRange,
  usedTopics: string[] = [],
): Promise<ReadingItem[]> {
  const client = getClient(apiKey);
  const systemInstruction = buildReadingSystemPrompt(options, range, usedTopics);
  const expectedCount = range === '18-34' ? 17 : 11;

  return callGeminiJson(
    client,
    systemInstruction,
    `독해 ${range}번 문항을 생성하라.`,
    readingResponseSchema,
    (raw) => {
      const parsed = z.object({ items: z.array(readingItemRawZod) }).parse(raw);
      if (parsed.items.length !== expectedCount) {
        throw new Error(`독해 ${range} 문항 개수가 ${expectedCount}개가 아닙니다 (받은 개수: ${parsed.items.length})`);
      }
      return parsed.items.map(normalizeReadingItem);
    },
  );
}

function extractTopics(reading: ReadingItem[]): string[] {
  return reading.map((item) => `${item.number}번(${item.type}): ${item.passage.slice(0, 40)}...`);
}

export type GenerationStage = 'listening' | 'reading-18-34' | 'reading-35-45' | 'done';

export async function generateExamSet(
  apiKey: string,
  options: ExamOptions,
  onProgress?: (stage: GenerationStage) => void,
): Promise<ExamSet> {
  onProgress?.('listening');
  const listening = await generateListening(apiKey, options);

  onProgress?.('reading-18-34');
  const reading1834 = await generateReading(apiKey, options, '18-34', []);

  onProgress?.('reading-35-45');
  const reading3545 = await generateReading(apiKey, options, '35-45', extractTopics(reading1834));

  onProgress?.('done');

  return {
    metadata: {
      title: `${options.yearLevel} 영어영역`,
      academyBranch: options.academyBranch,
      grade: options.grade,
      createdAt: new Date().toISOString(),
    },
    listening,
    reading: [...reading1834, ...reading3545],
  };
}
