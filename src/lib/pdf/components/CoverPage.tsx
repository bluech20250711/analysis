// Netlify Functions 배포 환경에서 classic JSX 변환이 적용될 수 있어 명시적으로 import
// (AnswerKeySection.tsx 상단 주석 참고).
import React from 'react';
void React; // react-jsx 자동 런타임에서는 JSX가 React를 직접 참조하지 않아 tsc가 미사용으로 보는 것을 방지
import { Page, Text, StyleSheet } from '@react-pdf/renderer';
import type { ExamSet } from '../../types';
import { FONT_FAMILY } from '../fonts';
import { PAGE_MARGIN_PT } from '../layout';

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    padding: PAGE_MARGIN_PT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  subtitle: { fontSize: 14, marginBottom: 40, textAlign: 'center' },
  metaRow: { fontSize: 11, marginBottom: 6 },
});

interface CoverPageProps {
  metadata: ExamSet['metadata'];
}

function CoverPage({ metadata }: CoverPageProps) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>{metadata.title}</Text>
      <Text style={styles.subtitle}>영어영역</Text>
      <Text style={styles.metaRow}>{metadata.academyBranch}</Text>
      <Text style={styles.metaRow}>{metadata.grade}</Text>
    </Page>
  );
}

export default CoverPage;
