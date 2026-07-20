import { Document } from '@react-pdf/renderer';
import type { ExamSet } from '../../types';
import { buildExamBlocks, paginateIntoColumns } from '../blocks';
import { COLUMN_HEIGHT_BUDGET_PT } from '../layout';
import CoverPage from './CoverPage';
import ExamColumnPageView from './ExamColumnPageView';
import AnswerKeySection from './AnswerKeySection';

function ExamDocument({ examSet }: { examSet: ExamSet }) {
  const blocks = buildExamBlocks(examSet.listening, examSet.reading);
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
