import { writeFile } from 'node:fs/promises';
import { buildExamPdf } from '../src/lib/pdf/buildPdf';
import { sampleListening, sampleReading } from './fixtures/sampleExamSet';
import type { ExamSet } from '../src/lib/types';

// Phase 6 PoC: 듣기 1-17 + 독해 18-45 45문항 전체를 표지 + 2단 문제지 + 정답/해설 섹션으로
// 구성된 PDF로 렌더링한다. 테스트 데이터는 scripts/fixtures/sampleExamSet.ts 참고
// (hwpx-full-exam-poc.ts와 동일한 픽스처 공유).

const sampleExamSet: ExamSet = {
  metadata: {
    title: '2027학년도 수능 대비 실전모의고사',
    academyBranch: '석우관',
    grade: '고3',
    createdAt: new Date().toISOString(),
  },
  listening: sampleListening,
  reading: sampleReading,
};

async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error('사용법: tsx scripts/pdf-full-exam-poc.ts <출력경로.pdf>');
    process.exit(1);
  }

  console.log('[pdf-full-exam-poc] 45문항 전체 PDF 렌더링 중...');
  const buffer = await buildExamPdf(sampleExamSet);
  await writeFile(outPath, buffer);
  console.log(`✅ 생성 완료: ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error('❌ 생성 실패:', err);
  process.exit(1);
});
