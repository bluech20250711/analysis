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

// ── 여러 줄로 줄바꿈되는 문단의 linesegarray 생성 ──────────────────────────
//
// HWPX는 문단이 화면에서 몇 줄로 줄바꿈되는지를 <hp:lineseg> 항목 개수로 표현한다.
// 짧은 텍스트(선택지 한 줄 등)는 1개만 있으면 되지만, 독해 지문처럼 여러 줄로
// 줄바꿈되는 긴 텍스트에 lineseg를 1개만 넣으면 한글이 실제 줄바꿈 위치를 몰라
// 여러 줄이 같은 위치에 겹쳐 그려진다(실사용 중 발견된 버그). 정확한 폰트 기반
// 줄바꿈 지점은 알 수 없으므로, 컬럼 폭 기준 평균 글자 수로 근사해 여러 줄로
// 나누고 각 줄마다 lineseg를 생성한다 — 실제 한글 줄바꿈과 다소 다를 수 있지만,
// 겹침 없이 표시되는 것이 훨씬 중요하다.

const LINE_HEIGHT = 1280; // vertsize(800) + spacing(480), 문서 전반에서 관찰된 값

function estimateCharsPerLine(text: string): number {
  const hangulCount = (text.match(/[가-힣]/g) ?? []).length;
  const ratio = hangulCount / Math.max(text.length, 1);
  return ratio > 0.3 ? 40 : 62; // 한글 위주 vs 영어 위주 폭 근사치
}

function splitTextIntoLines(text: string, charsPerLine: number): string[] {
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > charsPerLine) {
    let breakAt = remaining.lastIndexOf(' ', charsPerLine);
    if (breakAt <= 0) breakAt = charsPerLine; // 적절한 공백이 없으면 그냥 자름
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  lines.push(remaining);
  return lines;
}

function buildLinesegArrayXml(lines: string[], width: number): string {
  let textpos = 0;
  const segs = lines.map((line, i) => {
    const seg = `<hp:lineseg textpos="${textpos}" vertpos="${i * LINE_HEIGHT}" vertsize="800" textheight="800" baseline="680" spacing="480" horzpos="0" horzsize="${width}" flags="393216"/>`;
    textpos += line.length;
    return seg;
  });
  return `<hp:linesegarray>${segs.join('')}</hp:linesegarray>`;
}

// 텍스트 길이에 맞춰 정확한 개수의 lineseg를 가진 <hp:linesegarray>를 생성한다.
export function buildLinesegArrayForText(text: string, width: number): string {
  const lines = splitTextIntoLines(text, estimateCharsPerLine(text));
  return buildLinesegArrayXml(lines, width);
}

// 하나의 <hp:run>(텍스트 하나)로 이루어진 문단 전체를 생성한다(줄바꿈 겹침 방지 포함).
export function buildSimpleParagraphXml(
  text: string,
  charPrId: number,
  paraPrId: number,
  width: number,
): string {
  return `<hp:p id="0" paraPrIDRef="${paraPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${charPrId}"><hp:t>${escapeXmlText(text)}</hp:t></hp:run>${buildLinesegArrayForText(text, width)}</hp:p>`;
}
