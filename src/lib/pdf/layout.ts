// PDF 레이아웃 상수(A4, pt 단위) 및 텍스트 줄 수 추정.
// 실제 폰트 메트릭 대신 글자 폭 근사치로 줄 수를 추정한다 — HWPX의 lineseg 추정과
// 같은 이유(정확한 폰트 기반 줄바꿈 계산은 과한 엔지니어링, 대략적인 높이만 있으면
// 2단 컬럼에 문항을 적당히 분배하는 데는 충분하다)로 근사 방식을 택했다.

export const PAGE_WIDTH_PT = 595.28; // A4
export const PAGE_HEIGHT_PT = 841.89; // A4
export const PAGE_MARGIN_PT = 36;
export const COLUMN_GAP_PT = 18;
export const COLUMN_WIDTH_PT = (PAGE_WIDTH_PT - PAGE_MARGIN_PT * 2 - COLUMN_GAP_PT) / 2;
// 페이지 상단 표지 텍스트(문제지 종류 표기)에 쓰는 여유분을 뺀, 문항이 실제로 채워지는 높이.
export const COLUMN_HEIGHT_BUDGET_PT = PAGE_HEIGHT_PT - PAGE_MARGIN_PT * 2 - 24;

export const BODY_FONT_SIZE_PT = 9;
export const LINE_HEIGHT_PT = 13;
export const ITEM_SPACING_PT = 10;

const NON_ASCII_WIDTH = 1.8;
const CHARS_PER_LINE = 50; // COLUMN_WIDTH_PT(~270pt), 9pt 폰트 기준 실측 근사치

function visualWidth(text: string): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    width += text.charCodeAt(i) <= 0x7f ? 1 : NON_ASCII_WIDTH;
  }
  return width;
}

export function estimateLineCount(text: string): number {
  if (text.length === 0) return 1;
  return Math.max(1, Math.ceil(visualWidth(text) / CHARS_PER_LINE));
}

export function estimateTextHeight(text: string): number {
  return estimateLineCount(text) * LINE_HEIGHT_PT;
}
