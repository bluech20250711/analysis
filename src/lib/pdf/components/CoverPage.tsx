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
