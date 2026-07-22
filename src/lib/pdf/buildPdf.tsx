// Netlify Functions 배포 환경에서 classic JSX 변환이 적용될 수 있어 명시적으로 import
// (src/lib/pdf/components/AnswerKeySection.tsx 상단 주석 참고).
import React from 'react';
void React; // react-jsx 자동 런타임에서는 JSX가 React를 직접 참조하지 않아 tsc가 미사용으로 보는 것을 방지
import { renderToBuffer } from '@react-pdf/renderer';
import type { ExamSet } from '../types';
import { ensureFontRegistered } from './fonts';
import ExamDocument from './components/ExamDocument';

// ExamSet 전체(듣기 1-17 + 독해 18-45)를 표지 + 2단 문제지 + 정답/해설 섹션으로 구성된
// 하나의 PDF 버퍼로 렌더링한다. HWPX와 완전히 별도 파이프라인(설계스펙 7절)이며, 폰트는
// pdf/fonts.ts가 templates/pdf-template/fonts/의 한글 서브셋 OTF를 등록해 사용한다.
export async function buildExamPdf(examSet: ExamSet, mode: 'strict' | 'partial' = 'strict'): Promise<Buffer> {
  ensureFontRegistered();
  return renderToBuffer(<ExamDocument examSet={examSet} mode={mode} />);
}
