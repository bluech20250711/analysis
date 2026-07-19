import { writeFile } from 'node:fs/promises';
import { buildReadingSectionPoCHwpx } from '../src/lib/hwpx/buildHwpx';
import { renderStandardReadingItem } from '../src/lib/hwpx/readingSection';
import type { ReadingItem } from '../src/lib/types';

// 독해 섹션 PoC: 18번(표준형) + 25번(도표) + 27번(안내문) 3문항을 조립한다.
// 실제 이언어학원 독해 템플릿이 없어(CLAUDE.md 참고) 사용자가 제공한 실제 hwpx 참고자료
// (형식만 참고, 문항 내용은 사용하지 않음)를 바탕으로 구성 — 25/27은 표가 아니라 이미지로
// 삽입되는 것이 실제 형식이라 placeholder 이미지로 처리했고, 문항 자체는 표/박스 없이
// 순서대로 이어붙이면 문서에 이미 있는 진짜 다단(hp:colPr) 설정이 자동으로 2단에 배분한다.
// 정답/해설/해석은 듣기와 동일하게 각주(미주)에 숨겨 미주 답지 형태로 만든다.

const item18: ReadingItem = {
  number: 18,
  type: '목적 파악',
  instruction: '다음 글의 목적으로 가장 적절한 것은?',
  passage:
    'Dear Members of the Greenwood Community Center,\n\nWe have enjoyed serving our neighborhood for over a decade with a variety of programs, including yoga classes, art workshops, and children\'s reading groups. As many of you know, our building has recently required significant roof repairs due to storm damage last month.\n\nWe are writing to inform you that the community center will be temporarily closed from August 1st to August 15th while repairs are completed. All scheduled classes during this period will be rescheduled to the following weeks. We appreciate your patience and understanding during this time, and we look forward to welcoming you back to a safer, improved facility.\n\nSincerely,\nGreenwood Community Center Staff',
  passageKo:
    '그린우드 커뮤니티 센터 회원 여러분께,\n\n저희는 10년 넘게 요가 수업, 미술 워크숍, 어린이 독서 모임 등 다양한 프로그램으로 지역 주민 여러분을 만나 왔습니다. 아시다시피 지난달 폭풍 피해로 건물 지붕에 큰 수리가 필요하게 되었습니다.\n\n수리가 진행되는 동안 8월 1일부터 8월 15일까지 커뮤니티 센터가 임시 휴관함을 안내드립니다. 이 기간 예정되어 있던 모든 수업은 이후 주로 일정이 변경됩니다. 양해해 주셔서 감사드리며, 더 안전하고 개선된 시설에서 다시 뵙기를 기대합니다.\n\n그린우드 커뮤니티 센터 직원 일동',
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
  passageKo:
    '위 그래프는 2023년 고등학생들이 보고한 학습 방법별 이용 비율을 보여준다. 교과서 읽기가 68%로 가장 흔한 방법이었다. 온라인 강의 시청이 55%로 두 번째로 인기 있었다. 그룹 스터디는 40%, 플래시카드 앱은 32%가 이용했다. 개인 과외는 18%로 가장 적게 이용된 방법이었다.',
  imageRef: '막대그래프: 2023년 고등학생 학습 방법 이용 비율(교과서 읽기 68%, 온라인 강의 55%, 그룹 스터디 40%, 플래시카드 앱 32%, 개인 과외 18%)',
  chartData: {
    caption: '2023년 고등학생 학습 방법 이용 비율',
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

const item27: ReadingItem = {
  number: 27,
  type: '실용문 내용 일치/불일치',
  instruction: 'Maple Town Photo Contest에 관한 다음 안내문의 내용과 일치하지 않는 것은?',
  passage:
    'Maple Town is hosting its annual community photo contest. Share your best shots of local scenery and win great prizes!',
  passageKo:
    'Maple Town에서 연례 지역 사진 대회를 개최합니다. 지역 풍경을 담은 최고의 사진을 공유하고 멋진 상품을 받아 가세요!',
  imageRef: '안내문 이미지: Maple Town Photo Contest — 마감일 2026년 3월 20일, 참가대상 주민 누구나, 온라인 제출만 가능, 1인당 최대 3장, 대상 상금 100달러',
  chartData: {
    caption: 'Maple Town Photo Contest',
    headers: ['항목', '내용'],
    rows: [
      ['마감일', '2026년 3월 20일'],
      ['참가 대상', 'Maple Town 주민 누구나'],
      ['제출 방법', '웹사이트를 통한 온라인 제출만 가능'],
      ['1인 제출 한도', '최대 3장'],
      ['시상', '대상 1명에게 상금 100달러 지급'],
    ],
  },
  choices: [
    { number: 1, text: '마감일은 2026년 3월 20일이다.' },
    { number: 2, text: 'Maple Town 주민이면 누구나 참가할 수 있다.' },
    { number: 3, text: '우편으로도 제출할 수 있다.' },
    { number: 4, text: '1인당 최대 3장까지 제출 가능하다.' },
    { number: 5, text: '대상 수상자는 상금 100달러를 받는다.' },
  ],
  answer: 3,
  explanation:
    "안내문에 따르면 제출은 웹사이트를 통한 온라인 제출만 가능하다고 명시되어 있으므로, 안내문의 내용과 일치하지 않는 것은 ③ '우편으로도 제출할 수 있다.'이다.",
  keyVocab: [
    { word: 'contest', meaning: '대회' },
    { word: 'submission', meaning: '제출' },
    { word: 'resident', meaning: '주민' },
  ],
};

async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error('사용법: tsx scripts/hwpx-reading-poc.ts <출력경로.hwpx>');
    process.exit(1);
  }

  console.log('[hwpx-reading-poc] 독해 18번+25번+27번 조립 중...');

  const readingSectionXml = [item18, item25, item27]
    .map((item) => renderStandardReadingItem(item))
    .join('');

  const buffer = await buildReadingSectionPoCHwpx(readingSectionXml);
  await writeFile(outPath, buffer);
  console.log(`✅ 생성 완료: ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error('❌ 생성 실패:', err);
  process.exit(1);
});
