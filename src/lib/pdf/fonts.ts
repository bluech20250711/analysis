import { Font } from '@react-pdf/renderer';
import { FONT_BOLD_PATH, FONT_REGULAR_PATH } from './paths';

export const FONT_FAMILY = 'NotoSansKR';

// 시험지에는 영어(라틴)와 한글이 항상 섞여 나오므로, 표준 14개 PDF 내장 폰트(한글 미지원)
// 대신 한글+라틴을 모두 포함한 서브셋 폰트를 등록해서 쓴다.
// templates/pdf-template/fonts/*.otf는 Noto Sans CJK KR(OTC 내 KR 서브폰트)에서
// 실제 시험지에 쓰이는 문자 범위(라틴/한글 완성형·자모/문장부호/원문자 등)만 추출한 서브셋이다
// (원본 CJK 통합 폰트는 17MB대라 그대로 커밋하기엔 너무 커서 폰트당 2MB 내외로 줄였다).
let registered = false;

export function ensureFontRegistered(): void {
  if (registered) return;

  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: FONT_REGULAR_PATH, fontWeight: 'normal' },
      { src: FONT_BOLD_PATH, fontWeight: 'bold' },
    ],
  });

  registered = true;
}
