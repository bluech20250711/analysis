import { writeFile } from 'node:fs/promises';
import { buildReadingSectionPoCHwpx } from '../src/lib/hwpx/buildHwpx';
import { renderStandardReadingItem, renderTableReadingItem, distributeIntoColumns } from '../src/lib/hwpx/readingSection';
import type { ReadingItem } from '../src/lib/types';

// 독해 섹션 PoC: 18번(표준형) + 25번(도표형) 2문항을 2단 편집 레이아웃으로 조립한다.
// 실제 이언어학원 독해 템플릿이 없어(CLAUDE.md 참고) 처음부터 새로 구성한 레이아웃 검증용.

const item18: ReadingItem = {
  number: 18,
  type: '목적 파악',
  instruction: '다음 글의 목적으로 가장 적절한 것은?',
  passage:
    'Dear Members of the Greenwood Community Center,\n\nWe have enjoyed serving our neighborhood for over a decade with a variety of programs, including yoga classes, art workshops, and children\'s reading groups. As many of you know, our building has recently required significant roof repairs due to storm damage last month.\n\nWe are writing to inform you that the community center will be temporarily closed from August 1st to August 15th while repairs are completed. All scheduled classes during this period will be rescheduled to the following weeks. We appreciate your patience and understanding during this time, and we look forward to welcoming you back to a safer, improved facility.\n\nSincerely,\nGreenwood Community Center Staff',
  choices: [
    { number: 1, text: '커뮤니티 센터 신규 프로그램을 홍보하려고' },
    { number: 2, text: '지붕 수리로 인한 임시 휴관을 안내하려고' },
    { number: 3, text: '자원봉사자 모집을 공지하려고' },
    { number: 4, text: '회원 가입 절차 변경을 설명하려고' },
    { number: 5, text: '시설 이용 규정 위반을 경고하려고' },
  ],
  answer: 2,
  explanation:
    "글 후반부에 폭풍 피해로 인한 지붕 수리를 위해 8월 1일부터 15일까지 커뮤니티 센터가 임시 휴관한다고 안내하고 있으므로, 목적으로 가장 적절한 것은 ② '지붕 수리로 인한 임시 휴관을 안내하려고'이다.",
  keyVocab: [
    { word: 'temporarily', meaning: '일시적으로' },
    { word: 'reschedule', meaning: '일정을 변경하다' },
    { word: 'appreciate', meaning: '감사하다' },
  ],
};

const item25: ReadingItem = {
  number: 25,
  type: '도표 불일치',
  instruction: '다음 도표의 내용과 일치하지 않는 것은?',
  passage:
    'The graph above shows the percentage of high school students who reported using each type of study method in 2023. Reading textbooks was the most common method, chosen by 68% of students. Online video lectures were the second most popular, at 55%. Group study sessions were used by 40% of students, while flashcard apps were used by 32%. Private tutoring was the least common method, reported by only 18% of students.',
  chartData: {
    caption: '[표] 2023년 고등학생 학습 방법 이용 비율',
    headers: ['학습 방법', '이용 비율'],
    rows: [
      ['교과서 읽기', '68%'],
      ['온라인 강의 시청', '55%'],
      ['그룹 스터디', '40%'],
      ['플래시카드 앱', '32%'],
      ['개인 과외', '18%'],
    ],
  },
  choices: [
    { number: 1, text: '교과서 읽기는 가장 많이 사용된 학습 방법이다.' },
    { number: 2, text: '온라인 강의 시청 비율은 그룹 스터디보다 높다.' },
    { number: 3, text: '플래시카드 앱 이용 비율은 개인 과외보다 낮다.' },
    { number: 4, text: '그룹 스터디는 플래시카드 앱보다 이용 비율이 높다.' },
    { number: 5, text: '개인 과외는 가장 적게 사용된 학습 방법이다.' },
  ],
  answer: 3,
  explanation:
    '플래시카드 앱 이용 비율(32%)은 개인 과외(18%)보다 높으므로, 도표와 일치하지 않는 것은 ③이다.',
  keyVocab: [
    { word: 'percentage', meaning: '비율' },
    { word: 'flashcard', meaning: '플래시카드' },
    { word: 'tutoring', meaning: '과외' },
  ],
};

async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error('사용법: tsx scripts/hwpx-reading-poc.ts <출력경로.hwpx>');
    process.exit(1);
  }

  console.log('[hwpx-reading-poc] 독해 18번+25번 조립 중...');

  const fragments = [renderStandardReadingItem(item18), renderTableReadingItem(item25)];
  const { left, right } = distributeIntoColumns(fragments);

  const buffer = await buildReadingSectionPoCHwpx(left, right);
  await writeFile(outPath, buffer);
  console.log(`✅ 생성 완료: ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error('❌ 생성 실패:', err);
  process.exit(1);
});
