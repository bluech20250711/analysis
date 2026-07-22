// 유형별 생성(모의고사 유형별) UI에서 문항 번호별 유형명을 보여주기 위한 정적 목록.
// 듣기(1-17)는 사용자가 채팅으로 직접 확정해 전달한 명칭을 그대로 사용(Part1 표 원문을
// UI 표시용으로 일부 다듬은 버전 — 예: 8번 "언급 유무"는 원문 "언급되지 않은 것", 16-17번은
// 원문이 "긴 담화(공통 지문 2문항)" 하나였던 것을 번호별로 나눔).
// 독해(18-45)는 `docs/수능영어_모의고사_출제_프롬프트.md`의 [Part 2] 표 원문 "문항 유형"
// 컬럼을 그대로 사용하되, 41-42/43-45처럼 표에서 번호 범위로 묶여 있는 항목은 번호별로
// 나눠서 표시(각 번호가 실제로 채점하는 세부 유형 기준).
export interface ExamItemType {
  number: number;
  type: string;
}

export const LISTENING_ITEM_TYPES: ExamItemType[] = [
  { number: 1, type: '목적 추론' },
  { number: 2, type: '의견 파악' },
  { number: 3, type: '관계 추론' },
  { number: 4, type: '그림 불일치' },
  { number: 5, type: '할 일 파악' },
  { number: 6, type: '금액 계산' },
  { number: 7, type: '이유 파악' },
  { number: 8, type: '언급 유무' },
  { number: 9, type: '내용 불일치' },
  { number: 10, type: '표 내용 파악' },
  { number: 11, type: '짧은 대화 응답' },
  { number: 12, type: '짧은 대화 응답' },
  { number: 13, type: '긴 대화 응답' },
  { number: 14, type: '긴 대화 응답' },
  { number: 15, type: '상황에 적절한 말' },
  { number: 16, type: '주제 파악' },
  { number: 17, type: '언급 유무' },
];

export const READING_ITEM_TYPES: ExamItemType[] = [
  { number: 18, type: '목적 파악' },
  { number: 19, type: '심경/심경 변화' },
  { number: 20, type: '주장 파악' },
  { number: 21, type: '밑줄 함의 추론' },
  { number: 22, type: '요지 파악' },
  { number: 23, type: '주제 파악' },
  { number: 24, type: '제목 파악' },
  { number: 25, type: '도표 불일치' },
  { number: 26, type: '인물 소개 내용 불일치' },
  { number: 27, type: '실용문 내용 일치/불일치' },
  { number: 28, type: '실용문 내용 일치/불일치' },
  { number: 29, type: '어법성 판단' },
  { number: 30, type: '어휘 문맥 적합성' },
  { number: 31, type: '빈칸 추론(단어/구)' },
  { number: 32, type: '빈칸 추론(단어/구)' },
  { number: 33, type: '빈칸 추론(구/절)' },
  { number: 34, type: '빈칸 추론(고난도)' },
  { number: 35, type: '무관한 문장 찾기' },
  { number: 36, type: '글의 순서 배열' },
  { number: 37, type: '글의 순서 배열' },
  { number: 38, type: '문장 삽입' },
  { number: 39, type: '문장 삽입' },
  { number: 40, type: '요약문 완성' },
  { number: 41, type: '장문 독해(제목 고르기)' },
  { number: 42, type: '장문 독해(어휘 적합성)' },
  { number: 43, type: '장문 독해(순서 배열)' },
  { number: 44, type: '장문 독해(지칭 추론)' },
  { number: 45, type: '장문 독해(내용 불일치)' },
];
