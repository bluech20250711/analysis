import type { Choice, ReadingItem } from '../types';
import { READING_STYLE } from './readingStyleConfig';
import { buildLinesegArrayForText, buildSimpleParagraphXml, circledNumber, escapeXmlText } from './textUtils';

// 독해 18-45번 섹션을 처음부터 새로 조립하는 모듈.
// 실제 이언어학원 독해 템플릿이 없어(CLAUDE.md 참고) 원본 조각을 추출하는 대신
// 이미 검증된 듣기 섹션의 문단/각주/선택지 패턴을 재사용해 직접 XML을 구성한다.
// 스타일 값은 전부 readingStyleConfig.ts에서 가져온다.
//
// ⚠️ 사용자가 제공한 실제 hwpx 참고자료(45문항 전체 포함본)를 분석해 확인한 사실:
// - 2단 편집은 표가 아니라 HWP의 진짜 다단 기능(`hp:colPr`, NEWSPAPER 타입)으로 구현되어 있고,
//   이 다단 설정은 우리 템플릿(templates/hwpx-template)에도 원래부터 있었다(이전 분석에서 놓침).
//   따라서 문항들은 좌/우 컬럼을 직접 나눌 필요 없이 그냥 순서대로 이어붙이면 HWP가 알아서
//   컬럼에 배분한다 — 표 기반 2단 구현(wrapInTwoColumnTable 등)은 전부 제거함.
// - 25번(도표)·27-28번(안내문)은 표가 아니라 실제로 "이미지"로 삽입되어 있다. 우리는 실제
//   이미지 생성 파이프라인이 없으므로 텍스트 placeholder로 대체한다(아래 참고).
// - 41-42/43-45번 공유 지문도 테두리 박스 없이 일반 문단으로 되어 있다.
// - 정답/해설은 참고자료에서는 각주 처리가 안 되어 있었지만, 사용자 요청에 따라 듣기와 동일하게
//   각주(hp:endNote)로 숨기고 해석(passageKo)도 함께 넣어 미주 답지 형태로 구현한다.
//
// ⚠️ 실사용 중 발견된 버그와 수정: 문단마다 <hp:lineseg>를 1개만 넣었더니, 여러 줄로
// 줄바꿈되는 긴 지문에서 한글이 실제 줄 수를 몰라 텍스트가 겹쳐 보였다. 이제
// textUtils.buildSimpleParagraphXml()로 텍스트 길이에 맞는 lineseg 배열을 생성한다.
// 또한 이미지 placeholder로 재사용했던 BinData 이미지가 실제로는 이언어학원 뒷표지
// 배경 그림이라 어색하게 작게 나왔다 — 그림 대신 안내 텍스트로 대체했다.

let idCounter = 500000000;
function nextId(): number {
  idCounter += 1;
  return idCounter;
}

function simpleParagraph(text: string, charPrId: number, paraPrId: number, width: number): string {
  return buildSimpleParagraphXml(text, charPrId, paraPrId, width);
}

function emptyParagraph(width: number): string {
  return `<hp:p id="0" paraPrIDRef="${READING_STYLE.defaultParaPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${READING_STYLE.bodyCharPrId}"/><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="800" textheight="800" baseline="680" spacing="480" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
}

function choiceParagraph(choice: Choice, width: number): string {
  return simpleParagraph(`${circledNumber(choice.number)} ${choice.text}`, READING_STYLE.choiceCharPrId, 22, width);
}

function choicesXml(choices: Choice[], width: number): string {
  return [...choices]
    .sort((a, b) => a.number - b.number)
    .map((c) => choiceParagraph(c, width))
    .join('');
}

// 정답/해설/해석/핵심어휘를 각주(미주)로 숨긴다 — 문항 본문(지문·선택지)은 여기 포함하지 않는다.
function buildAnswerEndNote(
  number: number,
  answer: string,
  explanation: string,
  passageKo: string,
  keyVocab?: { word: string; meaning: string }[],
): string {
  const fullWidth = READING_STYLE.pageContentWidth;
  const autoNumMarker = `<hp:p id="0" paraPrIDRef="6" styleIDRef="6" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="11"><hp:ctrl><hp:autoNum num="1" numType="ENDNOTE"><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/></hp:autoNum></hp:ctrl><hp:t> </hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="900" textheight="900" baseline="765" spacing="272" horzpos="0" horzsize="${fullWidth}" flags="393216"/></hp:linesegarray></hp:p>`;

  const koPara = simpleParagraph(`▪해석: ${passageKo}`, READING_STYLE.bodyCharPrId, READING_STYLE.defaultParaPrId, fullWidth);
  const answerPara = simpleParagraph(`▪정답: ${answer}`, READING_STYLE.bodyCharPrId, READING_STYLE.defaultParaPrId, fullWidth);
  const explanationPara = simpleParagraph(`▪해설: ${explanation}`, READING_STYLE.bodyCharPrId, READING_STYLE.defaultParaPrId, fullWidth);
  const keyVocabPara = keyVocab && keyVocab.length > 0
    ? simpleParagraph(
        `▪핵심어휘: ${keyVocab.map((v) => `${v.word}(${v.meaning})`).join(', ')}`,
        READING_STYLE.bodyCharPrId,
        READING_STYLE.defaultParaPrId,
        fullWidth,
      )
    : '';

  const instId = nextId();
  return `<hp:ctrl><hp:endNote number="${number}" suffixChar="41" instId="${instId}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${autoNumMarker}${koPara}${answerPara}${explanationPara}${keyVocabPara}</hp:subList></hp:endNote></hp:ctrl>`;
}

function stemParagraph(item: ReadingItem, width: number): string {
  const numberLabel = `${item.number}. `;
  const endNoteXml = buildAnswerEndNote(item.number, String(item.answer), item.explanation, item.passageKo, item.keyVocab);
  // 두 run(번호 + 지시문)의 합쳐진 텍스트 기준으로 줄바꿈을 계산한다.
  const linesegXml = buildLinesegArrayForText(numberLabel + item.instruction, width);
  return `<hp:p id="0" paraPrIDRef="${READING_STYLE.defaultParaPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${READING_STYLE.bodyCharPrId}"><hp:t>${escapeXmlText(numberLabel)}</hp:t></hp:run><hp:run charPrIDRef="${READING_STYLE.instructionCharPrId}"><hp:t>${escapeXmlText(item.instruction)}</hp:t>${endNoteXml}<hp:t/></hp:run>${linesegXml}</hp:p>`;
}

// 이미지가 필요한 문항의 자리표시 텍스트 (25번 도표·27-28번 안내문 등 — 실제 시험지에서도
// 표가 아니라 이미지로 삽입됨을 실제 hwpx 참고자료로 확인함). 실제 이미지 생성 파이프라인이
// 없어 그림 대신 안내 텍스트로 대체한다 — 기존 BinData 이미지를 재사용하면 이언어학원
// 표지/배경용 그림이 엉뚱하게 작게 삽입되는 문제가 있어 이 방식으로 전환했다.
function imagePlaceholderParagraph(description: string, width: number): string {
  return simpleParagraph(`[이미지 자리표시 — ${description}]`, READING_STYLE.bodyCharPrId, READING_STYLE.defaultParaPrId, width);
}

function passageParagraphs(passage: string, width: number): string {
  // 단락 구분(빈 줄)이 있으면 문단을 나누고, 없으면 통 문단 하나로 처리.
  const paragraphs = passage.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const list = paragraphs.length > 0 ? paragraphs : [passage];
  return list.map((p) => simpleParagraph(p, READING_STYLE.bodyCharPrId, READING_STYLE.defaultParaPrId, width)).join(emptyParagraph(width));
}

function trailingSpacer(width: number): string {
  return emptyParagraph(width) + emptyParagraph(width);
}

// 18-39 등 표준형(25/27/28번 포함): 지시문 + 지문 + (필요 시 이미지 자리표시) + 5지선다.
// 25번(도표)·27-28번(안내문)도 imageRef를 채워 이 함수로 렌더링한다(표 아님, 이미지 자리표시).
export function renderStandardReadingItem(item: ReadingItem, width = READING_STYLE.columnWidth): string {
  if (Array.isArray(item.choices) === false) {
    throw new Error(`${item.number}번: 표준형 문항은 choices가 배열이어야 합니다.`);
  }
  const imageXml = item.imageRef ? imagePlaceholderParagraph(item.imageRef, width) : '';

  return (
    stemParagraph(item, width) +
    passageParagraphs(item.passage, width) +
    imageXml +
    choicesXml(item.choices as Choice[], width) +
    trailingSpacer(width)
  );
}

// 40번(요약문 완성): pairChoices를 5개 조합 선택지로 렌더링
export function renderSummaryReadingItem(item: ReadingItem, summary: string, width = READING_STYLE.columnWidth): string {
  if (Array.isArray(item.choices)) {
    throw new Error(`${item.number}번: 요약문 완성 문항은 choices.pairChoices 구조여야 합니다.`);
  }
  const [groupA, groupB] = item.choices.pairChoices;

  const summaryPara = simpleParagraph(`▶ 요약: ${summary}`, READING_STYLE.bodyCharPrId, READING_STYLE.defaultParaPrId, width);

  const comboChoices = [1, 2, 3, 4, 5].map((n) => {
    const a = groupA.find((c) => c.number === n);
    const b = groupB.find((c) => c.number === n);
    if (!a || !b) throw new Error(`${item.number}번: pairChoices ${n}번 조합을 찾을 수 없습니다.`);
    return simpleParagraph(`${circledNumber(n)} (A) ${a.text} … (B) ${b.text}`, READING_STYLE.choiceCharPrId, 22, width);
  }).join('');

  return (
    stemParagraph(item, width) +
    passageParagraphs(item.passage, width) +
    summaryPara +
    comboChoices +
    trailingSpacer(width)
  );
}

// 41-42, 43-45번: 공통 지문 1개(테두리 박스 없이 일반 문단) + 하위 문항 N개(각자 endNote/선택지 보유)
export function renderSharedPassageGroup(items: ReadingItem[], width = READING_STYLE.columnWidth): string {
  if (items.length === 0) throw new Error('renderSharedPassageGroup: items가 비어있습니다.');
  const sorted = [...items].sort((a, b) => a.number - b.number);
  const passageXml = passageParagraphs(sorted[0].passage, width);

  const subQuestionsXml = sorted
    .map((item) => {
      if (Array.isArray(item.choices) === false) {
        throw new Error(`${item.number}번: choices가 배열이어야 합니다.`);
      }
      return stemParagraph(item, width) + choicesXml(item.choices as Choice[], width) + emptyParagraph(width);
    })
    .join('');

  return passageXml + subQuestionsXml + trailingSpacer(width);
}
