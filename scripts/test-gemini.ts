import 'dotenv/config';
import { generateExamSet, generateListening, generateReading } from '../src/lib/gemini';
import type { ExamOptions } from '../src/lib/types';

// 사용법:
//   npm run test:gemini              -> 듣기 1~17번만 생성 (가장 빠름/저렴)
//   npm run test:gemini -- reading1  -> 독해 18~34번만 생성
//   npm run test:gemini -- reading2  -> 독해 35~45번만 생성
//   npm run test:gemini -- full      -> 45문항 전체(ExamSet) 생성

const mode = process.argv[2] ?? 'listening';

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
  console.log(`[test-gemini] mode=${mode} 로 Gemini 호출을 시작합니다...`);

  switch (mode) {
    case 'listening': {
      const items = await generateListening(apiKey, options);
      console.log(JSON.stringify(items, null, 2));
      console.log(`\n✅ 듣기 문항 ${items.length}개 생성 완료`);
      break;
    }
    case 'reading1': {
      const items = await generateReading(apiKey, options, '18-34');
      console.log(JSON.stringify(items, null, 2));
      console.log(`\n✅ 독해 18-34번 문항 ${items.length}개 생성 완료`);
      break;
    }
    case 'reading2': {
      const items = await generateReading(apiKey, options, '35-45');
      console.log(JSON.stringify(items, null, 2));
      console.log(`\n✅ 독해 35-45번 문항 ${items.length}개 생성 완료`);
      break;
    }
    case 'full': {
      const examSet = await generateExamSet(apiKey, options);
      console.log(JSON.stringify(examSet, null, 2));
      console.log(
        `\n✅ ExamSet 생성 완료 (듣기 ${examSet.listening.length}개, 독해 ${examSet.reading.length}개)`,
      );
      break;
    }
    default:
      console.error(`알 수 없는 모드: ${mode}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ 생성 실패:', err);
  process.exit(1);
});
