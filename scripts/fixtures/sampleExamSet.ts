import type { ListeningItem, ReadingItem } from '../../src/lib/types';

// 듣기 17문항 + 독해 28문항(40번 pairChoices, 41-42/43-45 공유지문 포함) 45문항 전체 테스트 데이터.
// hwpx-full-exam-poc.ts, PDF 렌더러 PoC 등 여러 스크립트가 공유하는 픽스처.
// 실제 문항 품질이 아니라 "45문항 전체 조립/레이아웃 메커니즘"을 검증하기 위한 간단한 데이터
// (실제 기출 표절 금지 원칙에 따라 전부 창작한 짧은 예시 문장이다).

function listeningItem(
  number: number,
  overrides: Partial<ListeningItem> &
    Pick<ListeningItem, 'instruction' | 'script' | 'scriptKo' | 'answer' | 'explanation' | 'choices'>,
): ListeningItem {
  return {
    number,
    type: overrides.type ?? `테스트유형${number}`,
    speakers: overrides.speakers ?? ['M', 'W'],
    ...overrides,
  };
}

function listeningChoices(prefix: string): ListeningItem['choices'] {
  return [1, 2, 3, 4, 5].map((n) => ({ number: n as 1 | 2 | 3 | 4 | 5, text: `${prefix} 선택지 ${n}` }));
}

function dialogue(n: number): { script: ListeningItem['script']; scriptKo: string[] } {
  const script: ListeningItem['script'] = [];
  const scriptKo: string[] = [];
  for (let i = 0; i < n; i++) {
    const speaker = i % 2 === 0 ? 'W' : 'M';
    script.push({ speaker, line: `Test line ${i + 1} spoken by ${speaker}.` });
    scriptKo.push(`테스트 대사 ${i + 1} (${speaker}).`);
  }
  return { script, scriptKo };
}

export const sampleListening: ListeningItem[] = [
  listeningItem(1, { instruction: '[PoC] 1번: 다음을 듣고, 남자가 하는 말의 목적으로 가장 적절한 것을 고르시오.', speakers: ['M'], ...dialogue(1), answer: 1, explanation: '[PoC] 1번 해설', choices: listeningChoices('1번') }),
  listeningItem(2, { instruction: '[PoC] 2번: 대화를 듣고, 남자의 의견으로 가장 적절한 것을 고르시오.', ...dialogue(6), answer: 2, explanation: '[PoC] 2번 해설', choices: listeningChoices('2번') }),
  listeningItem(3, { instruction: '[PoC] 3번: 다음을 듣고, 여자가 하는 말의 주제로 가장 적절한 것을 고르시오.', speakers: ['W'], ...dialogue(1), answer: 3, explanation: '[PoC] 3번 해설', choices: listeningChoices('3번') }),
  listeningItem(4, { instruction: '[PoC] 4번: 대화를 듣고, 그림에서 대화의 내용과 일치하지 않는 것을 고르시오. (이미지 생략 — 텍스트 선택지로 대체)', ...dialogue(8), answer: 4, explanation: '[PoC] 4번 해설', choices: listeningChoices('4번'), imageRef: '그림: 공원 벤치, 나무, 강아지 (PoC에서는 실제 이미지 미삽입)' }),
  listeningItem(5, { instruction: '[PoC] 5번: 대화를 듣고, 남자가 할 일로 가장 적절한 것을 고르시오.', ...dialogue(10), answer: 5, explanation: '[PoC] 5번 해설', choices: listeningChoices('5번') }),
  listeningItem(6, { instruction: '[PoC] 6번: 대화를 듣고, 여자가 지불할 금액을 고르시오.', ...dialogue(10), answer: 1, explanation: '[PoC] 6번 해설', choices: listeningChoices('6번') }),
  listeningItem(7, { instruction: '[PoC] 7번: 대화를 듣고, 여자가 공연에 갈 수 없는 이유를 고르시오.', ...dialogue(12), answer: 2, explanation: '[PoC] 7번 해설', choices: listeningChoices('7번') }),
  listeningItem(8, { instruction: '[PoC] 8번: 대화를 듣고, 언급되지 않은 것을 고르시오.', ...dialogue(12), answer: 3, explanation: '[PoC] 8번 해설', choices: listeningChoices('8번') }),
  listeningItem(9, { instruction: '[PoC] 9번: 대화를 듣고, 남자가 여자를 위해 할 일로 가장 적절한 것을 고르시오.', ...dialogue(14), answer: 4, explanation: '[PoC] 9번 해설', choices: listeningChoices('9번') }),
  listeningItem(10, { instruction: '[PoC] 10번: 다음 표를 보면서 대화를 듣고, 두 사람이 선택한 것을 고르시오. (표 생략 — 텍스트 선택지로 대체)', ...dialogue(10), answer: 5, explanation: '[PoC] 10번 해설', choices: listeningChoices('10번'), imageRef: '표: 호텔 비교표 (PoC에서는 실제 표 미삽입)' }),
  listeningItem(11, { instruction: '[PoC] 11번: 대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오.', ...dialogue(4), answer: 1, explanation: '[PoC] 11번 해설', choices: listeningChoices('11번') }),
  listeningItem(12, { instruction: '[PoC] 12번: 대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오.', ...dialogue(4), answer: 2, explanation: '[PoC] 12번 해설', choices: listeningChoices('12번') }),
  listeningItem(13, { instruction: '[PoC] 13번: 대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오. [3점]', ...dialogue(10), answer: 3, explanation: '[PoC] 13번 해설', choices: listeningChoices('13번') }),
  listeningItem(14, { instruction: '[PoC] 14번: 대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오.', ...dialogue(10), answer: 4, explanation: '[PoC] 14번 해설', choices: listeningChoices('14번') }),
  listeningItem(15, { instruction: '[PoC] 15번: 다음 상황 설명을 듣고, Michael이 Emily에게 할 말로 가장 적절한 것을 고르시오.', speakers: ['Narrator'], ...dialogue(1), answer: 5, explanation: '[PoC] 15번 해설', choices: listeningChoices('15번') }),
  listeningItem(16, {
    instruction: '[PoC] 16번: 여자가 하는 말의 주제로 가장 적절한 것은?',
    speakers: ['W'],
    ...dialogue(1),
    answer: 1,
    explanation: '[PoC] 16번 해설',
    choices: listeningChoices('16번'),
    pairGroupId: '16-17',
  }),
  listeningItem(17, {
    instruction: '[PoC] 17번: 언급되지 않은 것은?',
    speakers: ['W'],
    script: [],
    scriptKo: [],
    answer: 2,
    explanation: '[PoC] 17번 해설',
    choices: listeningChoices('17번'),
    pairGroupId: '16-17',
  }),
];

function readingChoices(prefix: string): { number: 1 | 2 | 3 | 4 | 5; text: string }[] {
  return [1, 2, 3, 4, 5].map((n) => ({ number: n as 1 | 2 | 3 | 4 | 5, text: `${prefix} 선택지 ${n}` }));
}

function standardReadingItem(number: number, type: string, instruction: string, imageRef?: string): ReadingItem {
  return {
    number,
    type,
    instruction,
    passage: `[PoC] ${number}번 지문. This is a short placeholder passage written only to verify the exam assembly pipeline for question ${number}. It intentionally repeats simple sentences so the line-wrap estimator has something realistic to measure against, without copying any real exam content.`,
    passageKo: `[PoC] ${number}번 지문의 한국어 해석입니다. 이 문장은 실제 시험 지문이 아니라 조립 파이프라인 검증용 예시 텍스트입니다.`,
    imageRef,
    chartData: imageRef
      ? { caption: `[PoC] ${number}번 참고 자료`, headers: ['항목', '값'], rows: [['예시 항목', '예시 값']] }
      : undefined,
    choices: readingChoices(`${number}번`),
    answer: (((number - 18) % 5) + 1),
    explanation: `[PoC] ${number}번 해설입니다.`,
    keyVocab: [{ word: `word${number}`, meaning: `뜻${number}` }],
  };
}

const standardReadingItems: ReadingItem[] = [
  standardReadingItem(18, '목적 파악', '다음 글의 목적으로 가장 적절한 것은?'),
  standardReadingItem(19, '심경 변화', '다음 글에 드러난 심경 변화로 가장 적절한 것은?'),
  standardReadingItem(20, '주장 파악', '다음 글에서 필자가 주장하는 바로 가장 적절한 것은?'),
  standardReadingItem(21, '밑줄 함의 추론', '밑줄 친 부분이 의미하는 바로 가장 적절한 것은? [3점]'),
  standardReadingItem(22, '요지 파악', '다음 글의 요지로 가장 적절한 것은?'),
  standardReadingItem(23, '주제 파악', '다음 글의 주제로 가장 적절한 것은?'),
  standardReadingItem(24, '제목 파악', '다음 글의 제목으로 가장 적절한 것은?'),
  standardReadingItem(25, '도표 불일치', '다음 도표의 내용과 일치하지 않는 것은?', '막대그래프: [PoC] 25번 예시 도표'),
  standardReadingItem(26, '인물 소개 내용 불일치', 'Jane Doe에 관한 다음 글의 내용과 일치하지 않는 것은?'),
  standardReadingItem(27, '실용문 내용 일치/불일치', '다음 안내문의 내용과 일치하지 않는 것은?', '안내문 이미지: [PoC] 27번 예시 안내문'),
  standardReadingItem(28, '실용문 내용 일치/불일치', '다음 안내문의 내용과 일치하지 않는 것은?', '안내문 이미지: [PoC] 28번 예시 안내문'),
  standardReadingItem(29, '어법성 판단', '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?'),
  standardReadingItem(30, '어휘 문맥 적합성', '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?'),
  standardReadingItem(31, '빈칸 추론', '다음 빈칸에 들어갈 말로 가장 적절한 것은?'),
  standardReadingItem(32, '빈칸 추론', '다음 빈칸에 들어갈 말로 가장 적절한 것은?'),
  standardReadingItem(33, '빈칸 추론', '다음 빈칸에 들어갈 말로 가장 적절한 것은? [3점]'),
  standardReadingItem(34, '빈칸 추론(고난도)', '다음 빈칸에 들어갈 말로 가장 적절한 것은? [3점]'),
  standardReadingItem(35, '무관한 문장 찾기', '다음 글에서 전체 흐름과 관계 없는 문장은?'),
  standardReadingItem(36, '글의 순서 배열', '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?'),
  standardReadingItem(37, '글의 순서 배열', '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?'),
  standardReadingItem(38, '문장 삽입', '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?'),
  standardReadingItem(39, '문장 삽입', '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?'),
];

const summaryItem: ReadingItem = {
  number: 40,
  type: '요약문 완성',
  instruction: '다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?',
  passage:
    '[PoC] 40번 지문. This is a short placeholder passage for the summary-completion question, written only to verify the exam assembly pipeline.',
  passageKo: '[PoC] 40번 지문의 한국어 해석입니다.',
  summary: 'The passage explains that (A) leads researchers to conclude that habits are best changed through (B) rather than willpower alone.',
  choices: {
    pairChoices: [
      [1, 2, 3, 4, 5].map((n) => ({ number: n as 1 | 2 | 3 | 4 | 5, text: `(A) 선택지 ${n}` })),
      [1, 2, 3, 4, 5].map((n) => ({ number: n as 1 | 2 | 3 | 4 | 5, text: `(B) 선택지 ${n}` })),
    ],
  },
  answer: '②',
  explanation: '[PoC] 40번 해설입니다.',
  keyVocab: [{ word: 'habit', meaning: '습관' }],
};

function sharedPassageSubItem(number: number, instruction: string, pairGroupId: string, sharedPassage: string, sharedPassageKo: string): ReadingItem {
  return {
    number,
    type: '장문 하위 문항',
    instruction,
    passage: sharedPassage,
    passageKo: sharedPassageKo,
    choices: readingChoices(`${number}번`),
    answer: (((number - 18) % 5) + 1),
    explanation: `[PoC] ${number}번 해설입니다.`,
    pairGroupId,
  };
}

const passage4142 =
  '[PoC] 41-42번 공유 지문. This longer placeholder passage is shared by two consecutive questions, written only to verify the shared-passage assembly path without copying any real exam content. It repeats simple explanatory sentences so the renderer has enough text to wrap across multiple lines.';
const passageKo4142 = '[PoC] 41-42번 공유 지문의 한국어 해석입니다.';

const item41 = sharedPassageSubItem(41, '윗글의 제목으로 가장 적절한 것은?', '41-42', passage4142, passageKo4142);
const item42 = sharedPassageSubItem(42, '윗글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?', '41-42', passage4142, passageKo4142);

const passage4345 =
  '[PoC] 43-45번 공유 지문(서사문). This placeholder narrative passage is shared by three consecutive questions, written only to verify the shared-passage assembly path for the three-question long-passage group without copying any real exam content.';
const passageKo4345 = '[PoC] 43-45번 공유 지문의 한국어 해석입니다.';

const item43 = sharedPassageSubItem(43, '주어진 글 (A)에 이어질 내용을 순서에 맞게 배열한 것은?', '43-45', passage4345, passageKo4345);
const item44 = sharedPassageSubItem(44, '밑줄 친 부분 중, 가리키는 대상이 나머지 넷과 다른 것은?', '43-45', passage4345, passageKo4345);
const item45 = sharedPassageSubItem(45, '윗글에 관한 내용으로 적절하지 않은 것은?', '43-45', passage4345, passageKo4345);

export const sampleReading: ReadingItem[] = [
  ...standardReadingItems,
  summaryItem,
  item41,
  item42,
  item43,
  item44,
  item45,
];
