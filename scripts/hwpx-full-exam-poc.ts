import { writeFile } from 'node:fs/promises';
import { buildFullExamHwpx } from '../src/lib/hwpx/buildHwpx';
import { sampleListening, sampleReading } from './fixtures/sampleExamSet';

// Phase 3 완료 검증: 듣기 1-17번 + 독해 18-45번 45문항 전체를 하나의 hwpx로 조립한다.
// 테스트 데이터는 scripts/fixtures/sampleExamSet.ts 참고(다른 PoC 스크립트와 공유).

async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error('사용법: tsx scripts/hwpx-full-exam-poc.ts <출력경로.hwpx>');
    process.exit(1);
  }

  console.log('[hwpx-full-exam-poc] 듣기 1-17번 + 독해 18-45번 45문항 전체 조립 중...');
  const buffer = await buildFullExamHwpx(sampleListening, sampleReading);
  await writeFile(outPath, buffer);
  console.log(`✅ 생성 완료: ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error('❌ 생성 실패:', err);
  process.exit(1);
});
