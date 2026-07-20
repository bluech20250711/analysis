import { Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ExamSet } from '../../types';
import { circledNumber } from '../blocks';
import { FONT_FAMILY } from '../fonts';
import { PAGE_MARGIN_PT } from '../layout';

const styles = StyleSheet.create({
  page: { fontFamily: FONT_FAMILY, padding: PAGE_MARGIN_PT },
  heading: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  entry: { marginBottom: 8 },
  number: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  line: { fontSize: 9, lineHeight: 1.4, marginBottom: 1 },
});

// 실제 시험지에는 없는, 정답/해설/해석만 모은 별도 섹션(교사용 정답지에 해당) —
// HWPX 쪽에서 각주(hp:endNote)로 숨기는 내용과 동일한 정보를 별도 문서 섹션으로 표현한다.
function AnswerKeySection({ examSet }: { examSet: ExamSet }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.heading}>정답 및 해설</Text>

      {[...examSet.listening]
        .sort((a, b) => a.number - b.number)
        .map((item) => (
          <View key={`listening-${item.number}`} style={styles.entry} wrap={false}>
            <Text style={styles.number}>
              {item.number}. 정답 {circledNumber(item.answer)}
            </Text>
            {item.scriptKo.length > 0 && <Text style={styles.line}>▪해석: {item.scriptKo.join(' ')}</Text>}
            <Text style={styles.line}>▪해설: {item.explanation}</Text>
          </View>
        ))}

      {[...examSet.reading]
        .sort((a, b) => a.number - b.number)
        .map((item) => (
          <View key={`reading-${item.number}`} style={styles.entry} wrap={false}>
            <Text style={styles.number}>
              {item.number}. 정답 {item.answer}
            </Text>
            <Text style={styles.line}>▪해석: {item.passageKo}</Text>
            <Text style={styles.line}>▪해설: {item.explanation}</Text>
            {item.keyVocab && item.keyVocab.length > 0 && (
              <Text style={styles.line}>▪핵심어휘: {item.keyVocab.map((v) => `${v.word}(${v.meaning})`).join(', ')}</Text>
            )}
          </View>
        ))}
    </Page>
  );
}

export default AnswerKeySection;
