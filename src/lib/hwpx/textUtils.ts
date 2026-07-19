const CIRCLED_DIGITS = ['①', '②', '③', '④', '⑤'] as const;

export function circledNumber(n: number): string {
  const symbol = CIRCLED_DIGITS[n - 1];
  if (!symbol) throw new Error(`circledNumber: 1~5 범위를 벗어났습니다 (받은 값: ${n})`);
  return symbol;
}

// HWPX(OWPML)의 <hp:t> 텍스트 노드에 들어갈 값 이스케이프.
export function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
