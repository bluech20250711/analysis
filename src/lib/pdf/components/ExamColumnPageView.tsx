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
