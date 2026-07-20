import { writeFile } from 'node:fs/promises';
import { buildListeningExamHwpx } from '../src/lib/hwpx/buildHwpx';
import type { ListeningItem } from '../src/lib/types';

// Phase 3 PoC: 고등부.hwpx 템플릿의 듣기 1~17번 전체를 테스트 데이터로 교체한다.
// 실제 문항 품질이 아니라 "17문항 전체 조립 메커니즘"을 검증하기 위한 간단한 데이터.

function item(
  number: number,
  overrides: Partial<ListeningItem> & Pick<ListeningItem, 'instruction' | 'script' | 'scriptKo' | 'answer' | 'explanation' | 'choices'>,
): ListeningItem {
  return {
    number,
    type: overrides.type ?? `테스트유형${number}`,
    speakers: overrides.speakers ?? ['M', 'W'],
    ...overrides,
  };
}

function choices(prefix: string): ListeningItem['choices'] {
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

const testListening: ListeningItem[] = [
  item(1, { instruction: '[PoC] 1번: 다음을 듣고, 남자가 하는 말의 목적으로 가장 적절한 것을 고르시오.', speakers: ['M'], ...dialogue(1), answer: 1, explanation: '[PoC] 1번 해설', choices: choices('1번') }),
  item(2, { instruction: '[PoC] 2번: 대화를 듣고, 남자의 의견으로 가장 적절한 것을 고르시오.', ...dialogue(6), answer: 2, explanation: '[PoC] 2번 해설', choices: choices('2번') }),
  item(3, { instruction: '[PoC] 3번: 다음을 듣고, 여자가 하는 말의 주제로 가장 적절한 것을 고르시오.', speakers: ['W'], ...dialogue(1), answer: 3, explanation: '[PoC] 3번 해설', choices: choices('3번') }),
  item(4, { instruction: '[PoC] 4번: 대화를 듣고, 그림에서 대화의 내용과 일치하지 않는 것을 고르시오. (이미지 생략 — 텍스트 선택지로 대체)', ...dialogue(8), answer: 4, explanation: '[PoC] 4번 해설', choices: choices('4번'), imageRef: '그림: 공원 벤치, 나무, 강아지 (PoC에서는 실제 이미지 미삽입)' }),
  item(5, { instruction: '[PoC] 5번: 대화를 듣고, 남자가 할 일로 가장 적절한 것을 고르시오.', ...dialogue(10), answer: 5, explanation: '[PoC] 5번 해설', choices: choices('5번') }),
  item(6, { instruction: '[PoC] 6번: 대화를 듣고, 여자가 지불할 금액을 고르시오.', ...dialogue(10), answer: 1, explanation: '[PoC] 6번 해설', choices: choices('6번') }),
  item(7, { instruction: '[PoC] 7번: 대화를 듣고, 여자가 공연에 갈 수 없는 이유를 고르시오.', ...dialogue(12), answer: 2, explanation: '[PoC] 7번 해설', choices: choices('7번') }),
  item(8, { instruction: '[PoC] 8번: 대화를 듣고, 언급되지 않은 것을 고르시오.', ...dialogue(12), answer: 3, explanation: '[PoC] 8번 해설', choices: choices('8번') }),
  item(9, { instruction: '[PoC] 9번: 대화를 듣고, 남자가 여자를 위해 할 일로 가장 적절한 것을 고르시오.', ...dialogue(14), answer: 4, explanation: '[PoC] 9번 해설', choices: choices('9번') }),
  item(10, { instruction: '[PoC] 10번: 다음 표를 보면서 대화를 듣고, 두 사람이 선택한 것을 고르시오. (표 생략 — 텍스트 선택지로 대체)', ...dialogue(10), answer: 5, explanation: '[PoC] 10번 해설', choices: choices('10번'), imageRef: '표: 호텔 비교표 (PoC에서는 실제 표 미삽입)' }),
  item(11, { instruction: '[PoC] 11번: 대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오.', ...dialogue(4), answer: 1, explanation: '[PoC] 11번 해설', choices: choices('11번') }),
  item(12, { instruction: '[PoC] 12번: 대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오.', ...dialogue(4), answer: 2, explanation: '[PoC] 12번 해설', choices: choices('12번') }),
  item(13, { instruction: '[PoC] 13번: 대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오. [3점]', ...dialogue(10), answer: 3, explanation: '[PoC] 13번 해설', choices: choices('13번') }),
  item(14, { instruction: '[PoC] 14번: 대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오.', ...dialogue(10), answer: 4, explanation: '[PoC] 14번 해설', choices: choices('14번') }),
  item(15, { instruction: '[PoC] 15번: 다음 상황 설명을 듣고, Michael이 Emily에게 할 말로 가장 적절한 것을 고르시오.', speakers: ['Narrator'], ...dialogue(1), answer: 5, explanation: '[PoC] 15번 해설', choices: choices('15번') }),
  item(16, {
    instruction: '[PoC] 16번: 여자가 하는 말의 주제로 가장 적절한 것은?',
    speakers: ['W'],
    ...dialogue(1),
    answer: 1,
    explanation: '[PoC] 16번 해설',
    choices: choices('16번'),
    pairGroupId: '16-17',
  }),
  item(17, {
    instruction: '[PoC] 17번: 언급되지 않은 것은?',
    speakers: ['W'],
    script: [],
    scriptKo: [],
    answer: 2,
    explanation: '[PoC] 17번 해설',
    choices: choices('17번'),
    pairGroupId: '16-17',
  }),
];

// renderListeningPair1617은 item17의 script 길이 검증을 하지 않으므로(공유 지문 사용) 빈 배열 허용.
// 단, validateScriptLengths(item16)만 검사 대상이라 item17은 영향 없음.

async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error('사용법: tsx scripts/hwpx-listening-poc.ts <출력경로.hwpx>');
    process.exit(1);
  }

  console.log('[hwpx-listening-poc] 듣기 1~17번 전체 조립 중...');
  const buffer = await buildListeningExamHwpx(testListening);
  await writeFile(outPath, buffer);
  console.log(`✅ 생성 완료: ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error('❌ 생성 실패:', err);
  process.exit(1);
});
