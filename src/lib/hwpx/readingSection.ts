import type { Choice, ReadingItem, ReadingTableData } from '../types';
import { READING_STYLE } from './readingStyleConfig';
import { circledNumber, escapeXmlText } from './textUtils';

// 독해 18-45번 섹션을 처음부터 새로 조립하는 모듈.
// 실제 이언어학원 독해 템플릿이 없어(Phase 3 CLAUDE.md 참고) 원본 조각을 추출하는 대신
// 이미 검증된 듣기 섹션의 문단/각주/선택지 패턴(listening-item.template.xml)을 재사용해
// 직접 XML을 구성한다. 스타일 값은 전부 readingStyleConfig.ts에서 가져온다.

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

// listening-item.template.xml의 endNote 구조(autoNum 마커 + 내용 문단)를 재사용.
// endNote 본문은 문서 하단 각주 영역에 별도로 렌더링되므로 폭은 전체 폭(24376) 그대로 둔다.
function buildAnswerEndNote(number: number, answer: string, explanation: string, keyVocab?: { word: string; meaning: string }[]): string {
  const fullWidth = READING_STYLE.pageContentWidth;
  const autoNumMarker = `<hp:p id="0" paraPrIDRef="6" styleIDRef="6" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="11"><hp:ctrl><hp:autoNum num="1" numType="ENDNOTE"><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/></hp:autoNum></hp:ctrl><hp:t> </hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="900" textheight="900" baseline="765" spacing="272" horzpos="0" horzsize="${fullWidth}" flags="393216"/></hp:linesegarray></hp:p>`;

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
  return `<hp:ctrl><hp:endNote number="${number}" suffixChar="41" instId="${instId}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${autoNumMarker}${answerPara}${explanationPara}${keyVocabPara}</hp:subList></hp:endNote></hp:ctrl>`;
}

function stemParagraph(item: ReadingItem, width: number): string {
  const endNoteXml = buildAnswerEndNote(item.number, String(item.answer), item.explanation, item.keyVocab);
  return `<hp:p id="0" paraPrIDRef="${READING_STYLE.defaultParaPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${READING_STYLE.bodyCharPrId}"><hp:t>${item.number}. </hp:t></hp:run><hp:run charPrIDRef="${READING_STYLE.instructionCharPrId}"><hp:t>${escapeXmlText(item.instruction)}</hp:t>${endNoteXml}<hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="800" textheight="800" baseline="680" spacing="400" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
}

// 이미지가 필요한 문항의 자리표시 이미지 (실제 이미지 생성 파이프라인 도입 전까지 사용).
function imagePlaceholderParagraph(description: string, width: number): string {
  const picId = nextId();
  const instId = nextId();
  const { placeholderImageBinDataId, placeholderImageWidth, placeholderImageHeight } = READING_STYLE;

  return `<hp:p id="0" paraPrIDRef="${READING_STYLE.defaultParaPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${READING_STYLE.bodyCharPrId}"><hp:pic id="${picId}" zOrder="1" numberingType="NONE" textWrap="SQUARE" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${instId}" reverse="0"><hp:offset x="0" y="0"/><hp:orgSz width="${placeholderImageWidth}" height="${placeholderImageHeight}"/><hp:curSz width="${placeholderImageWidth}" height="${placeholderImageHeight}"/><hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="0" centerY="0"/><hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo><hc:img binaryItemIDRef="${placeholderImageBinDataId}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${placeholderImageWidth}" y="0"/><hc:pt2 x="${placeholderImageWidth}" y="${placeholderImageHeight}"/><hc:pt3 x="0" y="${placeholderImageHeight}"/></hp:imgRect><hp:imgClip left="0" right="0" top="0" bottom="0"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${placeholderImageWidth}" dimheight="${placeholderImageHeight}"/><hp:effects/><hp:sz width="${placeholderImageWidth}" widthRelTo="ABSOLUTE" height="${placeholderImageHeight}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment>placeholder image — ${escapeXmlText(description)}</hp:shapeComment></hp:pic><hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="800" textheight="800" baseline="680" spacing="480" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
}

// 25번(도표)/27-28번(안내문)용 표. header row는 회색 배경 borderFill 재사용.
function buildDataTableXml(table: ReadingTableData, totalWidth: number): string {
  const colCount = table.headers.length;
  const colWidth = Math.floor(totalWidth / colCount);
  const rowHeight = 900;
  const allRows = [table.headers, ...table.rows];
  const rowCount = allRows.length;

  const trXml = allRows
    .map((rowCells, rowIdx) => {
      const isHeader = rowIdx === 0;
      const borderFillId = isHeader ? READING_STYLE.headerBorderFillId : READING_STYLE.bodyBorderFillId;
      const tcXml = rowCells
        .map((cellText, colIdx) => {
          const cellPara = simpleParagraph(cellText, READING_STYLE.bodyCharPrId, READING_STYLE.defaultParaPrId, colWidth - 400);
          return `<hp:tc name="" header="${isHeader ? '1' : '0'}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${borderFillId}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${cellPara}</hp:subList><hp:cellAddr colAddr="${colIdx}" rowAddr="${rowIdx}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${colWidth}" height="${rowHeight}"/><hp:cellMargin left="200" right="200" top="100" bottom="100"/></hp:tc>`;
        })
        .join('');
      return `<hp:tr>${tcXml}</hp:tr>`;
    })
    .join('');

  const tblId = nextId();
  return `<hp:tbl id="${tblId}" zOrder="1" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rowCount}" colCnt="${colCount}" cellSpacing="0" borderFillIDRef="${READING_STYLE.bodyBorderFillId}" noAdjust="0"><hp:sz width="${totalWidth}" widthRelTo="ABSOLUTE" height="${rowHeight * rowCount}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="141" bottom="141"/><hp:inMargin left="200" right="200" top="100" bottom="100"/>${trXml}</hp:tbl>`;
}

function tableWrapperParagraph(tableXml: string, width: number, caption?: string): string {
  const captionPara = caption ? simpleParagraph(caption, READING_STYLE.bodyCharPrId, READING_STYLE.defaultParaPrId, width) : '';
  return `${captionPara}<hp:p id="0" paraPrIDRef="${READING_STYLE.defaultParaPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${READING_STYLE.bodyCharPrId}">${tableXml}<hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="800" textheight="800" baseline="680" spacing="480" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
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

// 실제 수능 영어영역 문제지(PDF 형식 참고)에서 확인된 패턴: "주어진 글"/공유 지문/
// 안내문 등은 테두리 박스로 감싸 시각적으로 구분한다. 1행 1열 표(테두리=bodyBorderFillId)로
// 구현하며, 듣기 섹션의 안내 상자(listening-item.template.xml 최상단)와 동일한 방식이다.
function wrapInBorderedBox(innerXml: string, width: number): string {
  const tblId = nextId();
  const boxBorderFillId = READING_STYLE.bodyBorderFillId;
  return `<hp:p id="0" paraPrIDRef="${READING_STYLE.defaultParaPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${READING_STYLE.bodyCharPrId}"><hp:tbl id="${tblId}" zOrder="1" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="1" colCnt="1" cellSpacing="0" borderFillIDRef="${boxBorderFillId}" noAdjust="0"><hp:sz width="${width}" widthRelTo="ABSOLUTE" height="1000" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="141" bottom="141"/><hp:inMargin left="400" right="400" top="283" bottom="283"/><hp:tr><hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${boxBorderFillId}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${innerXml}</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${width}" height="1000"/><hp:cellMargin left="400" right="400" top="283" bottom="283"/></hp:tc></hp:tr></hp:tbl><hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="800" textheight="800" baseline="680" spacing="480" horzpos="0" horzsize="${width}" flags="393216"/></hp:linesegarray></hp:p>`;
}

// 박스 안 콘텐츠가 쓸 수 있는 실제 폭(좌우 셀 여백 400씩 제외)
function boxInnerWidth(width: number): number {
  return width - 800;
}

// 18-24, 26, 29-39 등 표준형: 지시문 + 지문 + 5지선다
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

// 25번(도표): 표준형 + 표. 실제 시험지는 막대그래프 "이미지"이지만 이미지 생성 파이프라인이
// 없어 표로 대체한다(테두리 박스 없이 배치 — PDF 참고 결과 25번 도표는 박스로 감싸지 않음).
export function renderChartReadingItem(item: ReadingItem, width = READING_STYLE.columnWidth): string {
  if (!item.chartData) {
    throw new Error(`${item.number}번: chartData가 필요합니다(25번 전용 렌더러).`);
  }
  if (Array.isArray(item.choices) === false) {
    throw new Error(`${item.number}번: choices가 배열이어야 합니다.`);
  }

  const tableXml = buildDataTableXml(item.chartData, width);

  return (
    stemParagraph(item, width) +
    tableWrapperParagraph(tableXml, width, item.chartData.caption) +
    passageParagraphs(item.passage, width) +
    choicesXml(item.choices as Choice[], width) +
    trailingSpacer(width)
  );
}

// 27-28번(안내문): 제목+표를 테두리 박스로 감싼다(PDF 참고 결과 안내문은 박스로 구분됨).
export function renderNoticeReadingItem(item: ReadingItem, width = READING_STYLE.columnWidth): string {
  if (!item.chartData) {
    throw new Error(`${item.number}번: chartData가 필요합니다(27/28번 전용 렌더러).`);
  }
  if (Array.isArray(item.choices) === false) {
    throw new Error(`${item.number}번: choices가 배열이어야 합니다.`);
  }

  const innerWidth = boxInnerWidth(width);
  const tableXml = buildDataTableXml(item.chartData, innerWidth);
  const noticeBoxXml = wrapInBorderedBox(
    tableWrapperParagraph(tableXml, innerWidth, item.chartData.caption),
    width,
  );

  return (
    stemParagraph(item, width) +
    passageParagraphs(item.passage, width) +
    noticeBoxXml +
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

// 41-42, 43-45번: 공통 지문 1개(테두리 박스, PDF 참고 결과) + 하위 문항 N개(각자 endNote/선택지 보유)
export function renderSharedPassageGroup(items: ReadingItem[], width = READING_STYLE.columnWidth): string {
  if (items.length === 0) throw new Error('renderSharedPassageGroup: items가 비어있습니다.');
  const sorted = [...items].sort((a, b) => a.number - b.number);
  const innerWidth = boxInnerWidth(width);
  const passageXml = wrapInBorderedBox(passageParagraphs(sorted[0].passage, innerWidth), width);

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

// 왼쪽/오른쪽 컬럼 콘텐츠를 보이지 않는 테두리의 1행 2열 표로 감싼다(2단 편집 구현).
export function wrapInTwoColumnTable(leftXml: string, rightXml: string): string {
  const { columnWidth, pageContentWidth, noBorderFillId } = READING_STYLE;
  const tblId = nextId();

  const cell = (contentXml: string, colAddr: number) =>
    `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${noBorderFillId}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${contentXml}</hp:subList><hp:cellAddr colAddr="${colAddr}" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${columnWidth}" height="1000"/><hp:cellMargin left="200" right="200" top="0" bottom="0"/></hp:tc>`;

  const tableXml = `<hp:tbl id="${tblId}" zOrder="1" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="1" colCnt="2" cellSpacing="0" borderFillIDRef="${noBorderFillId}" noAdjust="0"><hp:sz width="${pageContentWidth}" widthRelTo="ABSOLUTE" height="1000" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:tr>${cell(leftXml, 0)}${cell(rightXml, 1)}</hp:tr></hp:tbl>`;

  return `<hp:p id="0" paraPrIDRef="${READING_STYLE.defaultParaPrId}" styleIDRef="0" pageBreak="1" columnBreak="0" merged="0"><hp:run charPrIDRef="${READING_STYLE.bodyCharPrId}">${tableXml}<hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="800" textheight="800" baseline="680" spacing="480" horzpos="0" horzsize="${pageContentWidth}" flags="393216"/></hp:linesegarray></hp:p>`;
}

// 렌더된 문항 조각들을 좌/우 컬럼에 순서대로 절반씩 배분한다.
export function distributeIntoColumns(fragments: string[]): { left: string; right: string } {
  const half = Math.ceil(fragments.length / 2);
  return {
    left: fragments.slice(0, half).join(''),
    right: fragments.slice(half).join(''),
  };
}
