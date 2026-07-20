// 수능 영어영역 모의고사 문항 데이터 모델
// 출처: docs/수능영어_자동출제앱_설계스펙.md 3절

export interface Choice {
  number: 1 | 2 | 3 | 4 | 5;
  text: string;
}

export type Speaker = 'M' | 'W' | 'Narrator';

export interface ListeningItem {
  number: number; // 1~17
  type: string; // 유형명(예: "목적 파악") — 짧은 분류 라벨
  instruction: string; // 실제 시험지에 인쇄되는 지시문 전체 문장(예: "다음을 듣고, 남자가 하는 말의 목적으로 가장 적절한 것을 고르시오.")
  speakers: Speaker[];
  script: { speaker: Speaker; line: string }[];
  scriptKo: string[]; // script와 1:1 대응하는 한국어 해석 (실제 시험지 각주에 원문과 함께 삽입됨)
  choices: Choice[];
  answer: number;
  explanation: string;
  imageRef?: string;
  pairGroupId?: string;
}

// 25번(도표)/27-28번(안내문) 공용 표 데이터 형태
export interface ReadingTableData {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface ReadingItem {
  number: number; // 18~45
  type: string; // 유형명(예: "목적 파악") — 짧은 분류 라벨
  instruction: string; // 실제 시험지에 인쇄되는 지시문 전체 문장(예: "다음 글의 목적으로 가장 적절한 것은?")
  passage: string;
  passageKo: string; // 지문 전체 한국어 해석 (실제 시험지 각주/미주에 정답·해설과 함께 삽입됨)
  chartData?: ReadingTableData; // 25번(도표), 27-28번(안내문)의 원 데이터 — 실제 삽입은 imageRef 기반 placeholder 이미지 사용(실제 시험지는 표가 아니라 이미지임을 실제 hwpx 참고자료로 확인)
  choices: Choice[] | { pairChoices: [Choice[], Choice[]] };
  answer: number | string;
  explanation: string;
  keyVocab?: { word: string; meaning: string }[];
  imageRef?: string; // 이미지가 필요한 문항의 설명 문자열 (실제 이미지는 placeholder로 대체, ListeningItem과 동일 패턴). 25/27/28번은 항상 설정
  summary?: string; // 40번(요약문 완성) 전용 — (A)/(B) 빈칸이 표시된 요약문 자체. 40번만 설정
  pairGroupId?: string; // 41-42, 43-45 장문 묶음 식별자
}

export interface ExamSet {
  metadata: {
    title: string;
    academyBranch: string;
    grade: string;
    createdAt: string;
  };
  listening: ListeningItem[]; // length 17
  reading: ReadingItem[]; // length 28
}

export interface ExamOptions {
  yearLevel: string; // 예: "2027학년도 수능 대비 / 고3 6월 모의평가 수준"
  ebsLinked: boolean;
  grade: string; // 고1/고2/고3
  academyBranch: string;
  schoolStyle?: string; // 특정 학교 내신 스타일 참고 (선택)
}
