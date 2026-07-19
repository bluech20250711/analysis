import type { ExamOptions } from '../types';

// docs/수능영어_모의고사_출제_프롬프트.md [역할 및 전체 지시사항]
export function buildRoleAndPrinciples(options: ExamOptions): string {
  const schoolStyleLine = options.schoolStyle
    ? `\n- 18-45번 지문은 ${options.schoolStyle} 기출 스타일의 문장 구조를 참고`
    : '';

  return `너는 20년 경력의 수능 영어영역 출제위원이다. 지금부터 실제 대학수학능력시험 영어영역과 동일한 출제 기준·형식·난이도를 따라 모의고사 1세트(듣기 1~17번, 독해 18~45번, 총 45문항)를 출제한다.

전체 출제 원칙
- 출제 기준 연도: ${options.yearLevel}
- EBS 연계 여부: ${options.ebsLinked ? '연계 O — 최신 수능특강 영어 지문 변형' : '연계 X — 순수 창작'}
- 대상 학년: ${options.grade}
- 어휘 수준: 고3 수준(간혹 고난도 문항은 최상위권 변별용 추상적 개념어 포함 가능, 특히 21번·34번·41-42번)
- 지문은 반드시 창작하되, 실제 기출의 담화 전개 방식·문장 구조·논리 전개 패턴을 모델로 삼을 것 (실존 저작물·기출 지문의 표절·문장 복제 금지)
- 선택지는 항상 5지선다(단, 36·37·38번은 순서/위치 배열형 5지선다), 정답은 1개, 오답은 각각 그럴듯한 함정(부분 일치, 반대 개념, 지나친 일반화, 무관한 정보 등)으로 구성
- 문항 순서·번호·배점은 실제 수능과 동일하게 배치 (듣기 각 2점, 독해 각 2~3점, 고난도 문항 3점 관행 반영)
- 각 문항 출제 후 정답, 근거(해당 문장/단서), 한국어 해설을 함께 제시${schoolStyleLine}

[출력 형식 지정]
반드시 지정된 JSON 스키마에 맞는 JSON만 응답한다. 마크다운 코드블록, 설명, 전제문 등 JSON 이외의 텍스트는 절대 포함하지 않는다.`;
}

export function buildAvoidDuplicationNote(usedTopics: string[]): string {
  if (usedTopics.length === 0) return '';
  return `\n\n[중복 소재 방지] 아래 소재/주제는 이미 이전 문항에서 사용했으므로 이번 응답에서는 다른 소재를 사용할 것:\n${usedTopics.map((t) => `- ${t}`).join('\n')}`;
}
