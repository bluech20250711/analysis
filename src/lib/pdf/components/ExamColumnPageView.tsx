// Netlify Functions 배포 환경에서 classic JSX 변환이 적용될 수 있어 명시적으로 import
// (AnswerKeySection.tsx 상단 주석 참고).
import React from 'react';
void React; // react-jsx 자동 런타임에서는 JSX가 React를 직접 참조하지 않아 tsc가 미사용으로 보는 것을 방지
import { Page, View, StyleSheet } from '@react-pdf/renderer';
import type { ExamColumnPage } from '../blocks';
import ExamBlockView from './ExamBlockView';
import { FONT_FAMILY } from '../fonts';
import { COLUMN_GAP_PT, COLUMN_WIDTH_PT, PAGE_MARGIN_PT } from '../layout';

const styles = StyleSheet.create({
  page: { fontFamily: FONT_FAMILY, padding: PAGE_MARGIN_PT },
  row: { flexDirection: 'row' },
  column: { width: COLUMN_WIDTH_PT },
  columnGap: { width: COLUMN_GAP_PT },
});

function ExamColumnPageView({ page }: { page: ExamColumnPage }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.row}>
        <View style={styles.column}>
          {page.left.map((block, i) => (
            <ExamBlockView key={i} block={block} />
          ))}
        </View>
        <View style={styles.columnGap} />
        <View style={styles.column}>
          {page.right.map((block, i) => (
            <ExamBlockView key={i} block={block} />
          ))}
        </View>
      </View>
    </Page>
  );
}

export default ExamColumnPageView;
