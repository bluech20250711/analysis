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
  bodyBorderFillId: 6, // 실선 테두리(표 일반 셀)
  headerBorderFillId: 10, // 실선 + 회색 배경(표 헤더 행)

  // 2단 편집 레이아웃 (원본 문서 실측값 기준, HWPUNIT)
  pageContentWidth: 24376, // 듣기 섹션 본문 영역 폭과 동일하게 맞춤
  columnGap: 1200,
  get columnWidth() {
    return Math.floor((this.pageContentWidth - this.columnGap) / 2);
  },

  // 이미지가 필요한 문항의 placeholder (실제 이미지 생성 파이프라인 도입 전까지 사용)
  // BinData/image1.jpg를 재사용 — 내용상 문항과 무관한 자리표시용 이미지일 뿐이다.
  placeholderImageBinDataId: 'image1',
  placeholderImageWidth: 8000,
  placeholderImageHeight: 6000,
} as const;
