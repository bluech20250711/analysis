import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ExamBlock } from '../blocks';
import { circledNumber } from '../blocks';
import { BODY_FONT_SIZE_PT, LINE_HEIGHT_PT, ITEM_SPACING_PT } from '../layout';

const styles = StyleSheet.create({
  block: { marginBottom: ITEM_SPACING_PT },
  stem: { fontSize: BODY_FONT_SIZE_PT, lineHeight: LINE_HEIGHT_PT / BODY_FONT_SIZE_PT, marginBottom: 3 },
  passage: { fontSize: BODY_FONT_SIZE_PT, lineHeight: LINE_HEIGHT_PT / BODY_FONT_SIZE_PT, marginBottom: 4 },
  choice: { fontSize: BODY_FONT_SIZE_PT, lineHeight: LINE_HEIGHT_PT / BODY_FONT_SIZE_PT },
  subItem: { marginTop: 6 },
});

// 실제 시험지(학생용)에는 정답/해설/해석이 보이지 않는다 — instruction/passage/choices만 렌더링한다.
function ExamBlockView({ block }: { block: ExamBlock }) {
  switch (block.kind) {
    case 'listening':
      return (
        <View style={styles.block}>
          <Text style={styles.stem}>
            {block.item.number}. {block.item.instruction}
          </Text>
          {block.item.choices
            .slice()
            .sort((a, b) => a.number - b.number)
            .map((choice) => (
              <Text key={choice.number} style={styles.choice}>
                {circledNumber(choice.number)} {choice.text}
              </Text>
            ))}
        </View>
      );

    case 'reading-standard': {
      const item = block.item;
      if (!Array.isArray(item.choices)) return null;
      return (
        <View style={styles.block}>
          <Text style={styles.stem}>
            {item.number}. {item.instruction}
          </Text>
          <Text style={styles.passage}>{item.imageRef ? `[이미지 자리표시 — ${item.imageRef}]` : item.passage}</Text>
          {item.choices
            .slice()
            .sort((a, b) => a.number - b.number)
            .map((choice) => (
              <Text key={choice.number} style={styles.choice}>
                {circledNumber(choice.number)} {choice.text}
              </Text>
            ))}
        </View>
      );
    }

    case 'reading-summary': {
      const item = block.item;
      if (Array.isArray(item.choices)) return null;
      const [groupA, groupB] = item.choices.pairChoices;
      return (
        <View style={styles.block}>
          <Text style={styles.stem}>
            {item.number}. {item.instruction}
          </Text>
          <Text style={styles.passage}>{item.passage}</Text>
          <Text style={styles.passage}>▶ 요약: {item.summary ?? ''}</Text>
          {[1, 2, 3, 4, 5].map((n) => {
            const a = groupA.find((c) => c.number === n);
            const b = groupB.find((c) => c.number === n);
            if (!a || !b) return null;
            return (
              <Text key={n} style={styles.choice}>
                {circledNumber(n)} (A) {a.text} … (B) {b.text}
              </Text>
            );
          })}
        </View>
      );
    }

    case 'reading-shared-group': {
      const sorted = [...block.items].sort((a, b) => a.number - b.number);
      return (
        <View style={styles.block}>
          <Text style={styles.passage}>{sorted[0].passage}</Text>
          {sorted.map((item) => {
            if (!Array.isArray(item.choices)) return null;
            return (
              <View key={item.number} style={styles.subItem}>
                <Text style={styles.stem}>
                  {item.number}. {item.instruction}
                </Text>
                {item.choices
                  .slice()
                  .sort((a, b) => a.number - b.number)
                  .map((choice) => (
                    <Text key={choice.number} style={styles.choice}>
                      {circledNumber(choice.number)} {choice.text}
                    </Text>
                  ))}
              </View>
            );
          })}
        </View>
      );
    }
  }
}

export default ExamBlockView;
