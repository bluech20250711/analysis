import { writeFile } from 'node:fs/promises';
import { buildListeningPoCHwpx } from '../src/lib/hwpx/buildHwpx';
import type { ListeningFragmentData } from '../src/lib/hwpx/listeningFragment';

// Phase 2 PoC: 고등부.hwpx 템플릿의 1번 문항 조각을 테스트 데이터로 치환해
// 새 hwpx 파일을 생성한다. (원본과 뚜렷이 구분되는 소재로 검증 용이하게 구성)

const testItem: ListeningFragmentData = {
  number: 1,
  instruction: '다음을 듣고, 여자가 하는 말의 목적으로 가장 적절한 것을 고르시오.',
  scriptEn:
    "W: Good morning, Greenfield Public Library members. This is your head librarian, Ms. Carter. I'd like to inform you about a temporary change to our operating hours. Starting next Monday, the library will open one hour earlier, at 8 a.m., to accommodate students preparing for exams. This change will remain in effect for the next three weeks. Please note that the study rooms on the second floor will also be available during this extended time. We hope this helps you make the most of your preparation. Thank you for your understanding.",
  scriptKo:
    '좋은 아침입니다, 그린필드 공공 도서관 회원 여러분. 저는 사서 Carter입니다. 운영 시간의 임시 변경 사항을 안내드립니다. 다음 주 월요일부터 도서관은 시험을 준비하는 학생들을 위해 한 시간 일찍, 오전 8시에 문을 엽니다. 이 변경 사항은 앞으로 3주간 유지됩니다. 이 연장 시간 동안 2층 스터디룸도 이용하실 수 있습니다. 여러분의 시험 준비에 도움이 되길 바랍니다. 양해해 주셔서 감사합니다.',
  answer: 2,
  explanation:
    "사서 Carter는 시험 준비 학생들을 위해 도서관 운영 시간을 임시로 변경한다고 안내하고 있으므로, 여자가 하는 말의 목적으로 가장 적절한 것은 ② '도서관 임시 운영시간 변경을 공지하기 위해'이다.",
  choices: [
    '도서관 신규 회원 등록 방법을 안내하기 위해',
    '도서관 임시 운영시간 변경을 공지하기 위해',
    '스터디룸 예약 방법을 설명하기 위해',
    '시험 기간 도서 대출 규정을 알리기 위해',
    '도서관 보수 공사 일정을 공지하기 위해',
  ],
};

async function main() {
  console.log('[hwpx-poc] 템플릿 문항 1개 치환 중...');
  const buffer = await buildListeningPoCHwpx(testItem);

  const outPath = process.argv[2];
  if (!outPath) {
    console.error('사용법: tsx scripts/hwpx-poc.ts <출력경로.hwpx>');
    process.exit(1);
  }
  await writeFile(outPath, buffer);
  console.log(`✅ 생성 완료: ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error('❌ 생성 실패:', err);
  process.exit(1);
});
