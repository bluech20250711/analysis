import type { Choice, ListeningItem, ReadingItem } from '../types';
import { estimateTextHeight, ITEM_SPACING_PT } from './layout';

// 실제 시험지(학생용)에는 정답/해설/해석/핵심어휘가 보이지 않는다 — 이 값들은 별도의
// "정답 및 해설" 섹션에서만 노출한다(HWPX가 이걸 각주/미주로 숨기는 것과 같은 이유).
// ExamBlock은 딱 "문제지 본문에 실제로 인쇄되는 내용"만 표현한다.
export type ExamBlock =
  | { kind: 'listening'; item: ListeningItem }
  | { kind: 'reading-standard'; item: ReadingItem }
  | { kind: 'reading-summary'; item: ReadingItem }
  | { kind: 'reading-shared-group'; items: ReadingItem[] };

const CIRCLED_DIGITS = ['①', '②', '③', '④', '⑤'] as const;

export function circledNumber(n: number): string {
  const symbol = CIRCLED_DIGITS[n - 1];
  if (!symbol) throw new Error(`circledNumber: 1~5 범위를 벗어났습니다 (받은 값: ${n})`);
  return symbol;
}

function choiceText(choice: Choice): string {
  return `${circledNumber(choice.number)} ${choice.text}`;
}

// 18-45번을 번호 순서대로 순회하며 40/41-42/43-45를 각각의 블록 종류로 묶는다.
export function buildExamBlocks(listening: ListeningItem[], reading: ReadingItem[]): ExamBlock[] {
  const blocks: ExamBlock[] = [...listening]
    .sort((a, b) => a.number - b.number)
    .map((item) => ({ kind: 'listening', item }) as const);

  const byNumber = new Map(reading.map((item) => [item.number, item]));

  for (let n = 18; n <= 39; n++) {
    const item = byNumber.get(n);
    if (!item) throw new Error(`독해 ${n}번 문항 데이터가 없습니다.`);
    blocks.push({ kind: 'reading-standard', item });
  }

  const item40 = byNumber.get(40);
  if (!item40) throw new Error('독해 40번 문항 데이터가 없습니다.');
  blocks.push({ kind: 'reading-summary', item: item40 });

  const item41 = byNumber.get(41);
  const item42 = byNumber.get(42);
  if (!item41 || !item42) throw new Error('독해 41-42번 문항 데이터가 없습니다.');
  blocks.push({ kind: 'reading-shared-group', items: [item41, item42] });

  const item43 = byNumber.get(43);
  const item44 = byNumber.get(44);
  const item45 = byNumber.get(45);
  if (!item43 || !item44 || !item45) throw new Error('독해 43-45번 문항 데이터가 없습니다.');
  blocks.push({ kind: 'reading-shared-group', items: [item43, item44, item45] });

  return blocks;
}

function choicesHeight(choices: Choice[]): number {
  return choices.reduce((sum, c) => sum + estimateTextHeight(choiceText(c)), 0);
}

// 각 블록이 2단 컬럼에서 대략 몇 pt를 차지할지 추정한다(문항 배분용 근사치, 정확한
// 폰트 기반 계산 아님 — HWPX의 lineseg 추정과 동일한 접근).
export function estimateBlockHeight(block: ExamBlock): number {
  switch (block.kind) {
    case 'listening': {
      const stem = `${block.item.number}. ${block.item.instruction}`;
      return estimateTextHeight(stem) + choicesHeight(block.item.choices) + ITEM_SPACING_PT;
    }
    case 'reading-standard': {
      const item = block.item;
      if (!Array.isArray(item.choices)) throw new Error(`${item.number}번: 표준형 문항은 choices가 배열이어야 합니다.`);
      const stem = `${item.number}. ${item.instruction}`;
      const passageOrImage = item.imageRef ? `[이미지: ${item.imageRef}]` : item.passage;
      return (
        estimateTextHeight(stem) + estimateTextHeight(passageOrImage) + choicesHeight(item.choices) + ITEM_SPACING_PT
      );
    }
    case 'reading-summary': {
      const item = block.item;
      const stem = `${item.number}. ${item.instruction}`;
      const summaryLine = `▶ 요약: ${item.summary ?? ''}`;
      if (Array.isArray(item.choices)) throw new Error(`${item.number}번: 요약문 완성 문항은 pairChoices 구조여야 합니다.`);
      const comboCount = 5;
      return (
        estimateTextHeight(stem) +
        estimateTextHeight(item.passage) +
        estimateTextHeight(summaryLine) +
        comboCount * ITEM_SPACING_PT +
        ITEM_SPACING_PT
      );
    }
    case 'reading-shared-group': {
      const sorted = [...block.items].sort((a, b) => a.number - b.number);
      const passageHeight = estimateTextHeight(sorted[0].passage);
      const subItemsHeight = sorted.reduce((sum, item) => {
        if (!Array.isArray(item.choices)) throw new Error(`${item.number}번: choices가 배열이어야 합니다.`);
        const stem = `${item.number}. ${item.instruction}`;
        return sum + estimateTextHeight(stem) + choicesHeight(item.choices) + ITEM_SPACING_PT;
      }, 0);
      return passageHeight + subItemsHeight + ITEM_SPACING_PT;
    }
  }
}

export interface ExamColumnPage {
  left: ExamBlock[];
  right: ExamBlock[];
}

// 블록을 순서대로 좌→우 컬럼, 컬럼이 차면 다음 페이지로 배분한다.
// 컬럼이 비어있는 상태에서 블록 하나가 예산을 넘기면(41-42/43-45처럼 긴 공유지문 등)
// 다음 컬럼으로 넘기지 않고 그 컬럼에 그대로 채운다(빈 컬럼을 무한정 건너뛰는 것을 방지).
export function paginateIntoColumns(blocks: ExamBlock[], columnHeightBudget: number): ExamColumnPage[] {
  const pages: ExamColumnPage[] = [];
  let currentPage: ExamColumnPage = { left: [], right: [] };
  let currentColumn: 'left' | 'right' = 'left';
  let usedHeight = 0;

  for (const block of blocks) {
    const height = estimateBlockHeight(block);

    if (usedHeight > 0 && usedHeight + height > columnHeightBudget) {
      if (currentColumn === 'left') {
        currentColumn = 'right';
      } else {
        pages.push(currentPage);
        currentPage = { left: [], right: [] };
        currentColumn = 'left';
      }
      usedHeight = 0;
    }

    currentPage[currentColumn].push(block);
    usedHeight += height;
  }

  if (currentPage.left.length > 0 || currentPage.right.length > 0) pages.push(currentPage);

  return pages;
}
