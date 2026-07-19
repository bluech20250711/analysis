// 수능 영어영역 모의고사 문항 데이터 모델
// 출처: docs/수능영어_자동출제앱_설계스펙.md 3절

export interface Choice {
  number: 1 | 2 | 3 | 4 | 5;
  text: string;
}

export type Speaker = 'M' | 'W' | 'Narrator';

export interface ListeningItem {
  number: number; // 1~17
  type: string;
  speakers: Speaker[];
  script: { speaker: Speaker; line: string }[];
  choices: Choice[];
  answer: number;
  explanation: string;
  imageRef?: string;
  pairGroupId?: string;
}

export interface ReadingItem {
  number: number; // 18~45
  type: string;
  passage: string;
  chartData?: Record<string, unknown>;
  choices: Choice[] | { pairChoices: [Choice[], Choice[]] };
  answer: number | string;
  explanation: string;
  keyVocab?: { word: string; meaning: string }[];
  pairGroupId?: string;
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
