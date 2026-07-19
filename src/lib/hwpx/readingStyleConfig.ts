// 독해(18-45번) 섹션 조립에 쓰는 스타일 값을 한 곳에 모아둔 설정.
//
// 실제 이언어학원 독해 템플릿을 받으면, 이 파일의 값들(charPr/paraPr/borderFill ID,
// 컬럼 폭, placeholder 이미지 등)만 그 템플릿에서 실측한 값으로 교체하면 된다.
// (원본 템플릿이 없어서 지금은 templates/hwpx-template/Contents/header.xml에
// 이미 정의된 듣기 섹션용 스타일 ID를 재사용하고 있음 — Contents/header.xml 참고)

export const READING_STYLE = {
  // header.xml에 이미 정의된 charPr(글자모양) ID 재사용
  bodyCharPrId: 32, // 지문 본문 (기존 듣기 대본과 동일 스타일)
  instructionCharPrId: 40, // 문항 지시문
  choiceCharPrId: 32, // 선택지

  // header.xml에 이미 정의된 paraPr(문단모양) ID 재사용
  defaultParaPrId: 13,

  // header.xml에 이미 정의된 borderFill ID 재사용
  noBorderFillId: 2, // 테두리 없음(2단 컨테이너용)
  bodyBorderFillId: 6, // 실선 테두리(표 일반 셀, 지문/주어진 문장 박스에도 재사용)
  headerBorderFillId: 10, // 실선 + 회색 배경(표 헤더 행)

  // 2단 편집 레이아웃 (HWPUNIT)
  // 실제 수능 영어영역 문제지 PDF(A3, 842×1191pt)의 좌표를 실측해 비율을 뽑고,
  // 그 비율을 우리 템플릿의 기존 페이지 여백(section0.xml의 secPr margin: 좌우 4252)에
  // 적용해 계산한 값이다 — 실제 지문/문항 텍스트는 사용하지 않고 수치(여백/컬럼 비율)만 참고함.
  //   - 페이지 여백 비율 ≈ 10.4%, 컬럼 간격 비율 ≈ 4.66%(usable width 대비)
  //   - 우리 페이지: width 59528, 좌우 margin 4252×2 → usable width 51024
  //   - columnGap = 51024 × 0.0466 ≈ 2378
  //   - columnWidth = (51024 − 2378) / 2 ≈ 24323 (기존에 임의로 쓰던 24376과 거의 일치 — 우연히 검증됨)
  pageContentWidth: 51024, // 페이지 usable width 전체(2단 + 간격)
  columnGap: 2378,
  get columnWidth() {
    return Math.floor((this.pageContentWidth - this.columnGap) / 2);
  },

  // 페이지당 문항 배치 밀도 참고치(실제 시험지 관찰 결과) — 아직 자동 페이지 분할 로직에는
  // 반영하지 않았고, 향후 여러 페이지로 나눌 때 참고할 값
  approxStandardItemsPerColumn: 2, // 표준형(지문+5지선다) 기준

  // 이미지가 필요한 문항의 placeholder (실제 이미지 생성 파이프라인 도입 전까지 사용)
  // BinData/image1.jpg를 재사용 — 내용상 문항과 무관한 자리표시용 이미지일 뿐이다.
  placeholderImageBinDataId: 'image1',
  placeholderImageWidth: 8000,
  placeholderImageHeight: 6000,
} as const;
