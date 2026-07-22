// 문항 번호 배열(예: 유형별 생성에서 체크된 번호들)을 Gemini 호출 단위로 묶는다.
// 대부분의 번호는 문항 하나당 독립된 호출(유닛) 하나지만, 하나의 공유 지문/대본을 쓰는
// 짝 문항(16-17번, 41-42번, 43-45번)은 항상 그룹 전체를 하나의 유닛으로 함께 생성해야
// 한다 — 그렇지 않으면 예를 들어 42번만 생성할 때 41번이 만든 지문이 없어 42번이 참조할
// 대상 자체가 없어진다.
export interface GenerationUnit {
  kind: 'listening' | 'reading';
  numbers: number[]; // 오름차순, 1~3개(짝 그룹만 2~3개)
}

const PAIR_GROUPS: number[][] = [
  [16, 17],
  [41, 42],
  [43, 44, 45],
];

function findPairGroup(number: number): number[] | undefined {
  return PAIR_GROUPS.find((group) => group.includes(number));
}

// 선택된 번호 중 짝 그룹에 속한 번호가 하나라도 있으면 그룹 전체를 자동으로 포함시킨 뒤,
// 개별 유닛(1개) 또는 짝 그룹 유닛(2~3개)으로 묶어 오름차순으로 반환한다.
export function buildGenerationUnits(selectedNumbers: number[]): GenerationUnit[] {
  const selected = new Set(selectedNumbers);

  for (const group of PAIR_GROUPS) {
    if (group.some((n) => selected.has(n))) {
      group.forEach((n) => selected.add(n));
    }
  }

  const sorted = [...selected].sort((a, b) => a - b);
  const consumed = new Set<number>();
  const units: GenerationUnit[] = [];

  for (const number of sorted) {
    if (consumed.has(number)) continue;
    const kind: GenerationUnit['kind'] = number <= 17 ? 'listening' : 'reading';
    const pairGroup = findPairGroup(number);

    if (pairGroup) {
      units.push({ kind, numbers: pairGroup });
      pairGroup.forEach((n) => consumed.add(n));
    } else {
      units.push({ kind, numbers: [number] });
      consumed.add(number);
    }
  }

  return units;
}
