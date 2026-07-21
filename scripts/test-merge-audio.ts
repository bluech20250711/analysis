import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildListeningMergePlan, buildTtsLineId, resolveMergeSegments } from '../src/lib/audio/buildMergePlan';
import { mergeSegmentsToMp3 } from '../src/lib/audio/ffmpegMerge';
import { PAIR_1617_GAP_SECONDS, SIGNAL_TONE_SECONDS, STANDARD_GAP_SECONDS, INTRO_TO_FIRST_ITEM_GAP_SECONDS } from '../src/lib/audio/timing';
import type { ListeningItem } from '../src/lib/types';
import type { MergeSegmentSpec } from '../src/lib/audio/types';

// Phase 5 PoC: 실제 Google Cloud TTS 키 없이도 병합 메커니즘(신호음/정적구간/최종 mp3 조립)을
// 검증하기 위해, 대사 클립을 진짜 TTS 대신 문항마다 다른 주파수의 짧은 사인파로 대체한다.
// (Phase 4 test-tts.ts와 동일하게, 이 세션 환경에는 실제 TTS 키가 없어 음성 자체는 합성하지 못함)
// 사용법: npm run test:merge-audio -- <출력경로.mp3>

const FFMPEG_PATH = process.env.FFMPEG_PATH ?? 'ffmpeg';

function synthesizeFakeLineClip(frequencyHz: number, durationSeconds: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const result = spawnSync(
      FFMPEG_PATH,
      [
        '-f', 'lavfi',
        '-t', String(durationSeconds),
        '-i', `sine=frequency=${frequencyHz}:sample_rate=24000`,
        '-ar', '24000',
        '-ac', '1',
        '-c:a', 'libmp3lame',
        '-f', 'mp3',
        'pipe:1',
      ],
      { maxBuffer: 1024 * 1024 * 64 },
    );
    if (result.status !== 0) {
      reject(new Error(`가짜 클립 합성 실패: ${result.stderr?.toString().slice(-500)}`));
      return;
    }
    resolve(Buffer.from(result.stdout).toString('base64'));
  });
}

const testListening: ListeningItem[] = [
  {
    number: 1,
    type: '목적 파악',
    instruction: '[PoC] 1번',
    speakers: ['M'],
    script: [{ speaker: 'M', line: 'line1' }],
    scriptKo: ['테스트'],
    choices: [1, 2, 3, 4, 5].map((n) => ({ number: n as 1 | 2 | 3 | 4 | 5, text: `선택지${n}` })),
    answer: 1,
    explanation: '[PoC] 해설',
  },
  {
    number: 2,
    type: '의견 파악',
    instruction: '[PoC] 2번',
    speakers: ['M', 'W'],
    script: [
      { speaker: 'W', line: 'line1' },
      { speaker: 'M', line: 'line2' },
      { speaker: 'W', line: 'line3' },
    ],
    scriptKo: ['테스트1', '테스트2', '테스트3'],
    choices: [1, 2, 3, 4, 5].map((n) => ({ number: n as 1 | 2 | 3 | 4 | 5, text: `선택지${n}` })),
    answer: 2,
    explanation: '[PoC] 해설',
  },
  {
    number: 16,
    type: '주제 파악',
    instruction: '[PoC] 16번',
    speakers: ['W'],
    script: [{ speaker: 'W', line: 'shared line' }],
    scriptKo: ['공통 지문'],
    choices: [1, 2, 3, 4, 5].map((n) => ({ number: n as 1 | 2 | 3 | 4 | 5, text: `선택지${n}` })),
    answer: 3,
    explanation: '[PoC] 16번 해설',
    pairGroupId: '16-17',
  },
  {
    number: 17,
    type: '언급되지 않은 것',
    instruction: '[PoC] 17번',
    speakers: ['W'],
    script: [],
    scriptKo: [],
    choices: [1, 2, 3, 4, 5].map((n) => ({ number: n as 1 | 2 | 3 | 4 | 5, text: `선택지${n}` })),
    answer: 4,
    explanation: '[PoC] 17번 해설',
    pairGroupId: '16-17',
  },
];

async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error('사용법: tsx scripts/test-merge-audio.ts <출력경로.mp3>');
    process.exit(1);
  }

  console.log('[test-merge-audio] 가짜 클립(사인파)으로 병합 플랜 구성 중...');

  const clipsById = new Map<string, string>();
  clipsById.set('intro', await synthesizeFakeLineClip(200, 1));
  clipsById.set('outro', await synthesizeFakeLineClip(200, 1));

  for (const item of testListening) {
    for (let i = 0; i < item.script.length; i++) {
      const freq = 300 + item.number * 20 + i * 5;
      clipsById.set(buildTtsLineId(item.number, i), await synthesizeFakeLineClip(freq, 1));
    }
  }

  const segments: MergeSegmentSpec[] = buildListeningMergePlan({
    listening: testListening,
    clipsById,
    introClipId: 'intro',
    outroClipId: 'outro',
  });

  const expectedDurationSeconds = segments.reduce((sum, seg) => {
    if (seg.kind === 'clip') return sum + 1; // 가짜 클립은 전부 1초로 합성
    return sum + seg.seconds;
  }, 0);

  console.log(`[test-merge-audio] 세그먼트 ${segments.length}개, 예상 총 길이 ${expectedDurationSeconds}초`);
  console.log(
    `[test-merge-audio] 상수 확인: 신호음=${SIGNAL_TONE_SECONDS}s, 표준 정적=${STANDARD_GAP_SECONDS}s, 16-17번 이후 정적=${PAIR_1617_GAP_SECONDS}s, 인트로 뒤 정적=${INTRO_TO_FIRST_ITEM_GAP_SECONDS}s`,
  );

  // 실제 merge-audio-background.ts와 동일하게, 경량 스펙(클립 id만 참조)을 병합 직전에
  // clipsById로 실제 오디오 바이트로 해석(resolve)한 뒤 ffmpeg에 넘긴다.
  const resolvedSegments = resolveMergeSegments(segments, clipsById);
  const buffer = await mergeSegmentsToMp3(resolvedSegments, FFMPEG_PATH);
  await writeFile(outPath, buffer);
  console.log(`✅ 병합 완료: ${outPath} (${buffer.length} bytes)`);

  console.log('[test-merge-audio] ffprobe로 실제 재생 길이 검증 중...');
  const probeDir = await mkdtemp(path.join(tmpdir(), 'csat-merge-verify-'));
  try {
    const probeOut = spawnSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      outPath,
    ]);
    const actualDuration = parseFloat(probeOut.stdout.toString().trim());
    console.log(`[test-merge-audio] 실제 길이: ${actualDuration.toFixed(2)}초 (예상 ${expectedDurationSeconds}초)`);
    const diff = Math.abs(actualDuration - expectedDurationSeconds);
    if (diff > 1) {
      throw new Error(`실제 길이가 예상과 ${diff.toFixed(2)}초 차이납니다 — 병합 로직을 확인하세요.`);
    }
    console.log('✅ 길이 검증 통과 (오차 1초 이내)');
  } finally {
    await rm(probeDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('❌ 병합 실패:', err);
  process.exit(1);
});
