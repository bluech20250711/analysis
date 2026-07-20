import { readFile } from 'node:fs/promises';
import { LISTENING_SINGLE_LINE_FRAGMENT_PATH } from './paths';
import { circledNumber, escapeXmlText } from './textUtils';

// templates/hwpx-template/fragments/listening-single-line.template.xml 은
// 실제 고등부.hwpx의 1번 문항(단일 화자, 대사 1줄) 조각에서 텍스트만 {{PLACEHOLDER}}로
// 치환해 만든 템플릿이다. 실제 시험지는 영어 대본과 별도로 한국어 해석을 각주에 함께
// 넣는다 — 현재 ExamSet의 ListeningItem 타입에는 한국어 해석 필드가 없으므로,
// 이 PoC 단계에서는 별도의 입력 데이터(ListeningFragmentData)로 받는다.
// (2문항 이상, 대화 2턴 이상 문항 지원은 Phase 3에서 일반화 예정)
export interface ListeningFragmentData {
  number: number;
  instruction: string;
  scriptEn: string;
  scriptKo: string;
  answer: number; // 1~5
  explanation: string;
  choices: [string, string, string, string, string];
}

let cachedTemplate: string | null = null;

async function loadTemplate(): Promise<string> {
  if (cachedTemplate === null) {
    cachedTemplate = await readFile(LISTENING_SINGLE_LINE_FRAGMENT_PATH, 'utf-8');
  }
  return cachedTemplate;
}

export async function renderListeningItemFragment(data: ListeningFragmentData): Promise<string> {
  const template = await loadTemplate();

  const values: Record<string, string> = {
    NUMBER: String(data.number),
    INSTRUCTION: escapeXmlText(data.instruction),
    SCRIPT_EN: escapeXmlText(data.scriptEn),
    SCRIPT_KO: escapeXmlText(data.scriptKo),
    ANSWER: circledNumber(data.answer),
    EXPLANATION: escapeXmlText(data.explanation),
    CHOICE_1: escapeXmlText(data.choices[0]),
    CHOICE_2: escapeXmlText(data.choices[1]),
    CHOICE_3: escapeXmlText(data.choices[2]),
    CHOICE_4: escapeXmlText(data.choices[3]),
    CHOICE_5: escapeXmlText(data.choices[4]),
  };

  let result = template;
  for (const [key, value] of Object.entries(values)) {
    const token = `{{${key}}}`;
    if (!result.includes(token)) {
      throw new Error(`템플릿에서 플레이스홀더를 찾을 수 없습니다: ${token}`);
    }
    result = result.replace(token, value);
  }

  return result;
}
