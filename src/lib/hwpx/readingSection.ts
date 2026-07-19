import type { Choice, ReadingItem } from '../types';
import { READING_STYLE } from './readingStyleConfig';
import { circledNumber, escapeXmlText } from './textUtils';

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
// - 25번(도표)·27-28번(안내문)은 표가 아니라 실제로 "이미지"로 삽입되어 있다(BinData에 그림 파일).
//   우리는 이미지 생성 파이프라인이 없으므로 기존 placeholder 이미지로 대체한다(4번과 동일 패턴).
// - 41-42/43-45번 공유 지문도 테두리 박스 없이 일반 문단으로 되어 있다.
// - 정답/해설은 참고자료에서는 각주 처리가 안 되어 있었지만, 사용자 요청에 따라 듣기와 동일하게
//   각주(hp:endNote)로 숨기고 해석(passageKo)도 함께 넣어 미주 답지 형태로 구현한다.

let idCounter = 500000000;
function nextId(): number {
  idCounter += 1;
  return idCounter;
}

function simpleParagraph(text: string, charPrId: number, paraPrId: number, width: number): string {
  return `<hp:p id="0" paraPrIDRef="${paraPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${charPrId}"><hp:t>${escapeXmlText(text)}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="800" textheight="800" baseline="680" spacing="480" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
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
  const endNoteXml = buildAnswerEndNote(item.number, String(item.answer), item.explanation, item.passageKo, item.keyVocab);
  return `<hp:p id="0" paraPrIDRef="${READING_STYLE.defaultParaPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${READING_STYLE.bodyCharPrId}"><hp:t>${item.number}. </hp:t></hp:run><hp:run charPrIDRef="${READING_STYLE.instructionCharPrId}"><hp:t>${escapeXmlText(item.instruction)}</hp:t>${endNoteXml}<hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="800" textheight="800" baseline="680" spacing="400" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
}

// 이미지가 필요한 문항의 자리표시 이미지 (25번 도표·27-28번 안내문 등 — 실제 시험지에서도
// 표가 아니라 이미지로 삽입됨을 실제 hwpx 참고자료로 확인함). 실제 이미지 생성 파이프라인
// 도입 전까지 기존 BinData 이미지를 재사용한다.
function imagePlaceholderParagraph(description: string, width: number): string {
  const picId = nextId();
  const instId = nextId();
  const { placeholderImageBinDataId, placeholderImageWidth, placeholderImageHeight } = READING_STYLE;

  return `<hp:p id="0" paraPrIDRef="${READING_STYLE.defaultParaPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${READING_STYLE.bodyCharPrId}"><hp:pic id="${picId}" zOrder="1" numberingType="NONE" textWrap="SQUARE" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${instId}" reverse="0"><hp:offset x="0" y="0"/><hp:orgSz width="${placeholderImageWidth}" height="${placeholderImageHeight}"/><hp:curSz width="${placeholderImageWidth}" height="${placeholderImageHeight}"/><hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="0" centerY="0"/><hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo><hc:img binaryItemIDRef="${placeholderImageBinDataId}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${placeholderImageWidth}" y="0"/><hc:pt2 x="${placeholderImageWidth}" y="${placeholderImageHeight}"/><hc:pt3 x="0" y="${placeholderImageHeight}"/></hp:imgRect><hp:imgClip left="0" right="0" top="0" bottom="0"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${placeholderImageWidth}" dimheight="${placeholderImageHeight}"/><hp:effects/><hp:sz width="${placeholderImageWidth}" widthRelTo="ABSOLUTE" height="${placeholderImageHeight}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment>placeholder image — ${escapeXmlText(description)}</hp:shapeComment></hp:pic><hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="800" textheight="800" baseline="680" spacing="480" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
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

// 18-39 등 표준형(25/27/28번 포함): 지시문 + 지문 + (필요 시 이미지) + 5지선다.
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
