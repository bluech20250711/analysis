// 독해(18-45번) 섹션 조립에 쓰는 스타일 값을 한 곳에 모아둔 설정.
//
// 실제 이언어학원 독해 템플릿을 받으면, 이 파일의 값들(charPr/paraPr ID, 컬럼 폭,
// placeholder 이미지 등)만 그 템플릿에서 실측한 값으로 교체하면 된다.
// (원본 템플릿이 없어서 지금은 templates/hwpx-template/Contents/header.xml에
// 이미 정의된 듣기 섹션용 스타일 ID를 재사용하고 있음 — Contents/header.xml 참고)

export const READING_STYLE = {
  // header.xml에 이미 정의된 charPr(글자모양) ID 재사용
  bodyCharPrId: 32, // 지문 본문 (기존 듣기 대본과 동일 스타일)
  instructionCharPrId: 40, // 문항 지시문
  choiceCharPrId: 32, // 선택지

  // header.xml에 이미 정의된 paraPr(문단모양) ID 재사용
  defaultParaPrId: 13,

  // 2단 편집 레이아웃 (HWPUNIT)
  // 사용자가 제공한 실제 45문항 hwpx 참고자료를 분석해 확인한 값: 우리 템플릿
  // (templates/hwpx-template)에는 이미 진짜 다단 설정(<hp:colPr type="NEWSPAPER"
  // colCount="2" sameGap="2268">)이 문서 최상단(첫 문단의 secPr 직후)에 들어있었다
  // — 표로 2단을 흉내낼 필요 없이 문항을 순서대로 이어붙이기만 하면 HWP가 자동으로
  // 좌/우 컬럼에 배분한다. columnWidth=24376은 실제 문서의 문단 lineseg에서 실측한
  // 값(페이지 usable width 51024, colPr 간격 2268 기준 계산값 24378과 거의 일치).
  pageContentWidth: 51024, // 페이지 usable width 전체(2단 + 간격) — width 59528 - margin 4252×2
  columnGap: 2268, // hp:colPr의 sameGap 실측값
  columnWidth: 24376, // 문서에 실제 쓰인 lineseg horzsize 실측값

  // 페이지당 문항 배치 밀도 참고치(실제 시험지 관찰 결과) — 아직 자동 페이지 분할 로직에는
  // 반영하지 않았고, 향후 여러 페이지로 나눌 때 참고할 값
  approxStandardItemsPerColumn: 2, // 표준형(지문+5지선다) 기준
} as const;
