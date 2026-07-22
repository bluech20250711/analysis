// Netlify Functions 배포 환경에서 classic JSX 변환이 적용될 수 있어 명시적으로 import
// (AnswerKeySection.tsx 상단 주석 참고).
import React from 'react';
void React; // react-jsx 자동 런타임에서는 JSX가 React를 직접 참조하지 않아 tsc가 미사용으로 보는 것을 방지
import { Document } from '@react-pdf/renderer';
import type { ExamSet } from '../../types';
import { buildExamBlocks, paginateIntoColumns } from '../blocks';
import { COLUMN_HEIGHT_BUDGET_PT } from '../layout';
import CoverPage from './CoverPage';
import ExamColumnPageView from './ExamColumnPageView';
import AnswerKeySection from './AnswerKeySection';

function ExamDocument({ examSet, mode = 'strict' }: { examSet: ExamSet; mode?: 'strict' | 'partial' }) {
  const blocks = buildExamBlocks(examSet.listening, examSet.reading, mode);
  const pages = paginateIntoColumns(blocks, COLUMN_HEIGHT_BUDGET_PT);

  return (
    <Document>
      <CoverPage metadata={examSet.metadata} />
      {pages.map((page, i) => (
        <ExamColumnPageView key={i} page={page} />
      ))}
      <AnswerKeySection examSet={examSet} />
    </Document>
  );
}

export default ExamDocument;
