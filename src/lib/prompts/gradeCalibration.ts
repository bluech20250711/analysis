// 학년별 어휘 수준 / 문장 길이·구문 복잡도 / 소재 범위 보정 지시문.
// 문항 구조·화자 구성·전개 방식·오답 설계 원칙(listeningPrompt.ts의 PART1_ROWS)은 학년과
// 무관하게 동일하게 유지하고, 이 보정만 학년별로 달라진다 — buildRoleAndPrinciples
// (common.ts, 듣기·독해 공용)가 호출한다.
//
// ⚠️ 실사용 중 발견된 버그: 예전에는 "어휘 수준: 고3 수준"이 options.grade 값과 무관하게
// 항상 하드코딩되어 있었다 — 화면에 "대상 학년: 고1"이 표시돼도 실제 프롬프트 지시문은
// 고3 수준 그대로였다. 이 함수가 그 자리를 대체해 학년별로 실제 반영되게 한다.
interface GradeCalibration {
  vocab: string;
  sentence: string;
  topics: string;
}

const GRADE_CALIBRATIONS: Record<string, GradeCalibration> = {
  중3: {
    vocab: '중학교 필수 어휘 위주(중3 교육과정 수준). 전문용어·추상적 개념어는 배제하고 일상 회화 어휘 중심',
    sentence:
      '단문과 짧은 중문 위주로 구성. 관계사절·분사구문·도치 등 고급 구문은 사용하지 않고, 문장당 평균 길이를 짧게 유지',
    topics: '학교생활, 가족, 친구 관계, 취미, 동네 행사 등 학생 일상에 밀착된 소재 위주',
  },
  고1: {
    vocab: '고1 교육과정 필수 어휘 + 일상·학업 어휘. 추상적 개념어는 최소화',
    sentence: '단문과 간단한 복문 위주. 관계사절은 짧고 명확한 형태로 일부 허용하되, 분사구문·도치 등은 지양',
    topics: '학교생활·동아리 활동 중심에 진로 탐색 초기 단계, 지역사회 소재 정도로 확장',
  },
  고2: {
    vocab: '고2 교육과정 수준의 어휘. 사회·시사 관련 어휘를 일부 포함',
    sentence: '관계사절·분사구문 등 고급 구문이 자연스럽게 등장할 수 있으며 복문 비중을 늘림',
    topics: '사회 이슈, 진로·직업 탐색, 환경, 기술 등으로 소재 범위 확장',
  },
  고3: {
    vocab: '고3 수능 대비 표준 수준(간혹 고난도 문항은 최상위권 변별용 추상적 개념어 포함 가능, 특히 21번·34번·41-42번)',
    sentence: '관계사절, 분사구문, 도치 등 고급 구문을 자유롭게 사용',
    topics: '사회, 진로, 기술, 철학적·추상적 주제까지 폭넓게 다룸',
  },
};

const DEFAULT_GRADE = '고3'; // 미리 정의되지 않은 학년 값이 들어와도 이전 동작(고3 수준)과 동일하게 안전히 폴백

export function buildGradeCalibrationNote(grade: string): string {
  const calibration = GRADE_CALIBRATIONS[grade] ?? GRADE_CALIBRATIONS[DEFAULT_GRADE];
  return `- 어휘 수준: ${calibration.vocab}
- 문장 길이/구문 복잡도: ${calibration.sentence}
- 소재 범위: ${calibration.topics}`;
}
