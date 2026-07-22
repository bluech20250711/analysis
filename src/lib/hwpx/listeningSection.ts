import type { Choice, ListeningItem } from '../types';
import { READING_STYLE } from './readingStyleConfig';
import { buildLinesegArrayForText, buildSimpleParagraphXml, circledNumber, escapeXmlText } from './textUtils';

// 듣기 1~17번 섹션을 처음부터 새로 조립하는 모듈.
//
// ⚠️ 이전 버전은 templates/hwpx-template/fragments/의 정적 템플릿(listening-line,
// listening-item, listening-1617-pair)에 텍스트만 치환하는 방식이었다. 그 템플릿들은
// 문단마다 <hp:lineseg>를 고정 개수(대개 1개)만 갖고 있어서, 짧은 PoC 테스트 문장에서는
// 우연히 문제가 없었지만 실제 Gemini가 생성하는 긴 지시문·해설·대사에서는 독해 섹션과
// 동일한 겹침 버그가 발생할 수밖에 없었다(readingSection.ts에서 먼저 발견·수정된 버그).
// 이제 독해 섹션과 동일하게 textUtils.buildSimpleParagraphXml()로 텍스트 길이에 맞는
// lineseg 배열을 매번 계산해서 생성한다.
//
// ⚠️ 또한 기존 listening-1617-pair.template.xml에는 "▪선택지해석:" 블록에 실제
// 참고 원본 시험지의 진짜 내용(예: "① 전통적 농업과 도시 농업의 비교")이 파라미터화되지
// 않은 채 그대로 하드코딩되어 있어, 생성되는 모든 시험지에 이 내용이 그대로 노출되는
// 문제가 있었다. Choice 타입에 선택지 번역 필드가 없어(CLAUDE.md "알려진 단순화" 참고)
// 이 블록 자체를 완전히 제거했다 — 정적 템플릿 3종 파일은 더 이상 사용하지 않는다.
//
// 4번(그림 불일치)·10번(표 문제)은 표준 텍스트 5지선다로 대체한다 — 실제 이미지·표
// 렌더링은 별도 파이프라인이 필요해 이번 Phase 범위 밖이다(향후 확장 필요).

const COLUMN_WIDTH = READING_STYLE.columnWidth;
const BODY_CHAR = READING_STYLE.bodyCharPrId; // 32
const INSTRUCTION_CHAR = READING_STYLE.instructionCharPrId; // 40
const DEFAULT_PARA = READING_STYLE.defaultParaPrId; // 13
const SCRIPT_CHAR = 42; // listening-line.template.xml에서 실측
const STEM_PARA = 70; // listening-item.template.xml 문항 stem/spacer 문단모양
const CHOICE_PARA = 22; // 1~15번 선택지 문단모양
const PAIR16_CHOICE_PARA = 2; // 16번 선택지 문단모양(원본 그대로 유지)
const MARKER_STYLE_PARA = 6;
const MARKER_STYLE_CHAR = 11;
const ENDNOTE_CARRIER_CHAR = 48; // endNote 컨트롤만 담는 빈 run(16-17번 stem에서 실측)

let idCounter = 1600000000;
function nextId(): number {
  idCounter += 1;
  return idCounter;
}

function getChoiceText(choices: Choice[], n: number): string {
  const found = choices.find((c) => c.number === n);
  if (!found) throw new Error(`선택지 ${n}번을 찾을 수 없습니다.`);
  return found.text;
}

function validateScriptLengths(item: ListeningItem): void {
  if (item.script.length !== item.scriptKo.length) {
    throw new Error(
      `${item.number}번: script(${item.script.length}개)와 scriptKo(${item.scriptKo.length}개)의 길이가 다릅니다.`,
    );
  }
  if (item.script.length === 0) {
    throw new Error(`${item.number}번: script가 비어 있습니다.`);
  }
}

function emptyParagraph(width: number, paraPrId: number = DEFAULT_PARA, charPrId: number = BODY_CHAR): string {
  return `<hp:p id="0" paraPrIDRef="${paraPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${charPrId}"/><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="800" textheight="800" baseline="680" spacing="480" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
}

// "16-17번) " 같은 짧은 단일 행 라벨 전용 — autoNum 마커와 같은 스타일(paraPr 6 / charPr 11).
function markerStyleParagraph(text: string, width: number): string {
  return `<hp:p id="0" paraPrIDRef="${MARKER_STYLE_PARA}" styleIDRef="6" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${MARKER_STYLE_CHAR}"><hp:t>${escapeXmlText(text)}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="900" textheight="900" baseline="765" spacing="272" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
}

function emptyMarkerParagraph(width: number): string {
  return `<hp:p id="0" paraPrIDRef="${MARKER_STYLE_PARA}" styleIDRef="6" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${MARKER_STYLE_CHAR}"/><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="900" textheight="900" baseline="765" spacing="272" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
}

function autoNumMarkerParagraph(number: number, width: number): string {
  return `<hp:p id="0" paraPrIDRef="${MARKER_STYLE_PARA}" styleIDRef="6" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${MARKER_STYLE_CHAR}"><hp:ctrl><hp:autoNum num="${number}" numType="ENDNOTE"><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/></hp:autoNum></hp:ctrl><hp:t> </hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="900" textheight="900" baseline="765" spacing="272" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
}

function scriptLinesXml(lines: string[], width: number): string {
  return lines.map((line) => buildSimpleParagraphXml(line, SCRIPT_CHAR, DEFAULT_PARA, width)).join('');
}

function choicesXml(choices: Choice[], width: number, paraPrId: number): string {
  return [1, 2, 3, 4, 5]
    .map((n) => buildSimpleParagraphXml(`${circledNumber(n)} ${getChoiceText(choices, n)}`, BODY_CHAR, paraPrId, width))
    .join('');
}

// 1~15번 공용 endNote: autoNum 마커 → 영어 대본 → 한국어 해석 → 정답 → 해설.
function buildStandardEndNote(item: ListeningItem, width: number): string {
  const scriptEnXml = scriptLinesXml(item.script.map((s) => `${s.speaker}: ${s.line}`), width);
  const scriptKoXml = scriptLinesXml(item.scriptKo, width);
  const answerPara = buildSimpleParagraphXml(`▪정답: ${circledNumber(item.answer)}`, BODY_CHAR, DEFAULT_PARA, width);
  const explanationPara = buildSimpleParagraphXml(`▪해설: ${item.explanation}`, BODY_CHAR, DEFAULT_PARA, width);
  const instId = nextId();
  return `<hp:ctrl><hp:endNote number="${item.number}" suffixChar="41" instId="${instId}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${autoNumMarkerParagraph(item.number, width)}${scriptEnXml}${emptyParagraph(width)}${scriptKoXml}${emptyParagraph(width)}${answerPara}${explanationPara}${emptyParagraph(width)}${emptyParagraph(width)}</hp:subList></hp:endNote></hp:ctrl>`;
}

// 1~15번 공용: 단일 문항(자체 endNote 보유)
export function renderStandardListeningItem(item: ListeningItem): string {
  validateScriptLengths(item);
  const width = COLUMN_WIDTH;
  const numberLabel = `${item.number}. `;
  const endNoteXml = buildStandardEndNote(item, width);
  const linesegXml = buildLinesegArrayForText(numberLabel + item.instruction, width);
  const stemPara = `<hp:p id="0" paraPrIDRef="${STEM_PARA}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${BODY_CHAR}"><hp:t>${escapeXmlText(numberLabel)}</hp:t></hp:run><hp:run charPrIDRef="${INSTRUCTION_CHAR}"><hp:t>${escapeXmlText(item.instruction)}</hp:t>${endNoteXml}<hp:t/></hp:run>${linesegXml}</hp:p>`;

  return (
    stemPara +
    choicesXml(item.choices, width, CHOICE_PARA) +
    emptyParagraph(width, STEM_PARA) +
    emptyParagraph(width, STEM_PARA)
  );
}

// 16번 endNote: 공유 지문(영어 대본/한국어 해석)을 포함 — 대본은 16번 데이터만 사용.
function build1617EndNoteFor16(item16: ListeningItem, width: number): string {
  const scriptEnXml = scriptLinesXml(item16.script.map((s) => `${s.speaker}: ${s.line}`), width);
  const scriptKoXml = scriptLinesXml(item16.scriptKo, width);
  const answerPara = buildSimpleParagraphXml(`▪정답: ${circledNumber(item16.answer)}`, BODY_CHAR, DEFAULT_PARA, width);
  const explanationPara = buildSimpleParagraphXml(`▪해설: ${item16.explanation}`, BODY_CHAR, DEFAULT_PARA, width);
  const instId = nextId();
  return `<hp:ctrl><hp:endNote number="16" suffixChar="41" instId="${instId}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${emptyMarkerParagraph(width)}${markerStyleParagraph('16-17번) ', width)}${emptyParagraph(width)}${scriptEnXml}${emptyParagraph(width)}${scriptKoXml}${emptyParagraph(width)}${autoNumMarkerParagraph(16, width)}${emptyParagraph(width)}${answerPara}${explanationPara}${emptyParagraph(width)}</hp:subList></hp:endNote></hp:ctrl>`;
}

// 17번 endNote: 공유 지문이 이미 16번 쪽에 있으므로 정답/해설만.
function build1617EndNoteFor17(item17: ListeningItem, width: number): string {
  const answerPara = buildSimpleParagraphXml(`▪정답: ${circledNumber(item17.answer)}`, BODY_CHAR, DEFAULT_PARA, width);
  const explanationPara = buildSimpleParagraphXml(`▪해설: ${item17.explanation}`, BODY_CHAR, DEFAULT_PARA, width);
  const instId = nextId();
  return `<hp:ctrl><hp:endNote number="17" suffixChar="41" instId="${instId}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${autoNumMarkerParagraph(17, width)}${emptyParagraph(width)}${answerPara}${explanationPara}${emptyParagraph(width)}</hp:subList></hp:endNote></hp:ctrl>`;
}

// 16-17번 전용: 공통 지문(item16의 script/scriptKo만 사용) + 문항 2개
export function renderListeningPair1617(item16: ListeningItem, item17: ListeningItem): string {
  validateScriptLengths(item16);
  const width = COLUMN_WIDTH;

  const sharedStemPara = buildSimpleParagraphXml('16-17. 다음을 듣고 물음에 답하시오. ', BODY_CHAR, DEFAULT_PARA, width);
  const spacer1 = emptyParagraph(width);

  const text16 = `16. ${item16.instruction}`;
  const endNote16 = build1617EndNoteFor16(item16, width);
  const lineseg16 = buildLinesegArrayForText(text16, width);
  const stem16 = `<hp:p id="0" paraPrIDRef="${DEFAULT_PARA}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${BODY_CHAR}"><hp:t>${escapeXmlText(text16)}</hp:t></hp:run><hp:run charPrIDRef="${ENDNOTE_CARRIER_CHAR}">${endNote16}<hp:t/></hp:run>${lineseg16}</hp:p>`;

  const spacer2 = emptyParagraph(width);

  const text17 = `17. ${item17.instruction}`;
  const endNote17 = build1617EndNoteFor17(item17, width);
  const lineseg17 = buildLinesegArrayForText(text17, width);
  const stem17 = `<hp:p id="0" paraPrIDRef="${DEFAULT_PARA}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${BODY_CHAR}"><hp:t>${escapeXmlText(text17)}</hp:t></hp:run><hp:run charPrIDRef="${ENDNOTE_CARRIER_CHAR}">${endNote17}<hp:t/></hp:run>${lineseg17}</hp:p>`;

  return (
    sharedStemPara +
    spacer1 +
    stem16 +
    choicesXml(item16.choices, width, PAIR16_CHOICE_PARA) +
    spacer2 +
    stem17 +
    choicesXml(item17.choices, width, DEFAULT_PARA)
  );
}

// mode: 'strict'(기본값, "모의고사 1세트"용) — 1~17번 중 하나라도 없으면 에러.
//       'partial'("모의고사 유형별"의 부분 시험지용) — 없는 번호(16-17은 그룹 단위)는
//       건너뛰고 실제로 있는 문항만으로 섹션을 조립한다.
export async function buildListeningSectionXml(
  listening: ListeningItem[],
  mode: 'strict' | 'partial' = 'strict',
): Promise<string> {
  const byNumber = new Map(listening.map((item) => [item.number, item]));
  const parts: string[] = [];

  for (let n = 1; n <= 15; n++) {
    const item = byNumber.get(n);
    if (!item) {
      if (mode === 'partial') continue;
      throw new Error(`듣기 ${n}번 문항 데이터가 없습니다.`);
    }
    parts.push(renderStandardListeningItem(item));
  }

  const item16 = byNumber.get(16);
  const item17 = byNumber.get(17);
  if (!item16 || !item17) {
    if (mode !== 'partial') throw new Error('듣기 16-17번 문항 데이터가 없습니다.');
  } else {
    parts.push(renderListeningPair1617(item16, item17));
  }

  return parts.join('');
}
