import 'dotenv/config';
import { generateExamItems } from '../src/lib/examGenerationOrchestration';
import { buildGenerationUnits } from '../src/lib/generationUnits';
import type { ExamOptions } from '../src/lib/types';

// 사용법 (설계스펙 v2 — 문항별 개별 생성):
//   npm run test:gemini                    -> 듣기 1~17번 생성
//   npm run test:gemini -- 1,3,18,22,31    -> 지정한 번호만 생성(짝 문항 16-17/41-42/43-45는 자동 확장)
//   npm run test:gemini -- 18-45           -> 범위 표기 지원(독해 28문항 전체)
//   npm run test:gemini -- 1-45            -> 45문항 전체

const arg = process.argv[2] ?? '1-17';

function parseNumbers(spec: string): number[] {
  const numbers = new Set<number>();
  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      for (let n = start; n <= end; n++) numbers.add(n);
    } else {
      numbers.add(Number(trimmed));
    }
  }
  return [...numbers].sort((a, b) => a - b);
}

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY 환경변수가 없습니다. .env 파일에 설정해주세요. (이 스크립트는 개발용 CLI 테스트 도구이며, 실제 앱은 브라우저에서 사용자가 입력한 키를 사용합니다.)');
  process.exit(1);
}
const apiKey: string = process.env.GEMINI_API_KEY;

const options: ExamOptions = {
  yearLevel: '2027학년도 수능 대비 / 고3 6월 모의평가 수준',
  ebsLinked: false,
  grade: '고3',
  academyBranch: '이언어학원 나루관',
};

async function main() {
  const numbers = parseNumbers(arg);
  const units = buildGenerationUnits(numbers);
  console.log(`[test-gemini] 문항 ${numbers.join(', ')}번 생성을 시작합니다 (유닛 ${units.length}개)...`);

  const { listening, reading } = await generateExamItems(apiKey, options, units, (unitNumbers, entry) => {
    console.log(`  [${entry.status}] ${unitNumbers.join(', ')}번${entry.message ? ` — ${entry.message}` : ''}`);
  });

  console.log(JSON.stringify({ listening, reading }, null, 2));
  console.log(`\n✅ 생성 완료 — 듣기 ${listening.length}개, 독해 ${reading.length}개`);

  const succeeded = new Set([...listening.map((i) => i.number), ...reading.map((i) => i.number)]);
  const failed = numbers.filter((n) => !succeeded.has(n));
  if (failed.length > 0) {
    console.error(`⚠️ 실패한 문항: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ 생성 실패:', err);
  process.exit(1);
});
