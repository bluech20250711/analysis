import type { ExamOptions } from './types';

// "모의고사 1세트"/"모의고사 유형별" 양쪽 화면이 공유하는 기본 출제 옵션.
export const DEFAULT_EXAM_OPTIONS: ExamOptions = {
  yearLevel: '2027학년도 수능 대비 / 고3 6월 모의평가 수준',
  ebsLinked: false,
  grade: '고3',
  academyBranch: '이언어학원 나루관',
};
