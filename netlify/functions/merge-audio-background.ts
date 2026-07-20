import { createRequire } from 'node:module';
import path from 'node:path';
import type { BackgroundHandler } from '@netlify/functions';
import { mergeSegmentsToMp3 } from '../../src/lib/audio/ffmpegMerge';
import type { MergeSegment } from '../../src/lib/audio/types';
import { connectBlobsForBackgroundFunction, getJobStore } from '../../src/lib/netlifyBlobsStore';

// Phase 5: 듣기 1-17번 개별 TTS 클립 + 신호음 + 정적구간을 하나의 MP3로 병합한다.
// ffmpeg 병합은 Netlify 동기 함수의 10초 제한을 넘길 수 있어 Background Function으로 분리했다
// (파일명이 "-background"로 끝나면 Netlify가 자동으로 Background Function으로 인식·최대 15분 실행).
// Background Function은 호출자에게 즉시 202를 반환하고 결과를 되돌려줄 수 없으므로,
// 완료 여부/결과물은 Netlify Blobs에 저장하고 get-merged-audio.ts가 폴링으로 제공한다.

interface RequestBody {
  jobId: string;
  segments: MergeSegment[];
}

// ffmpeg-static은 optionalDependencies로 선언되어 있다 — Netlify 빌드 환경(전체 인터넷 접근
// 가능)에서는 실제로 설치되어 바이너리가 번들되지만, 로컬 개발 sandbox 등 일부 환경에서는
// 설치 자체가 생략될 수 있다. 정적 import는 두 환경에서 타입체크 결과가 서로 달라지므로
// (설치 안 됨: 모듈 없음 에러 / 설치됨: 정상), require를 런타임에 동적으로 호출해 두 환경
// 모두에서 동일하게(타입 에러 없이) 컴파일되도록 한다.
//
// ⚠️ createRequire의 앵커로 import.meta.url을 쓰면 Netlify의 esbuild 번들링 결과가
// CJS라 import.meta가 빈 객체로 치환되어 import.meta.url이 undefined가 되고, 그 값을
// fileURLToPath류 API에 넘기면 "path 인자가 string/URL이어야 한다"는 TypeError가 발생한다
// (실사용 중 HWPX와 동일한 원인으로 발견). import.meta.url 대신 실제 파일 존재 여부와
// 무관하게 디렉터리 앵커로만 쓰이는 process.cwd() 기반 경로를 사용해 이 문제를 피한다.
function resolveFfmpegPath(): string | null {
  try {
    const require = createRequire(path.join(process.cwd(), 'index.js'));
    return require('ffmpeg-static') as string | null;
  } catch {
    return null;
  }
}

export const handler: BackgroundHandler = async (event) => {
  // Background Function은 일반 동기 함수와 달리 Netlify Blobs 컨텍스트가 자동으로
  // 주입되지 않을 수 있다(실사용 중 MissingBlobsEnvironmentError 확인) — getStore 호출 전에
  // 반드시 먼저 연결한다.
  connectBlobsForBackgroundFunction(event);

  const { jobId, segments } = JSON.parse(event.body ?? '{}') as RequestBody;
  const store = getJobStore('audio-merge-jobs');

  try {
    if (!jobId) throw new Error('jobId가 필요합니다.');
    if (!Array.isArray(segments) || segments.length === 0) throw new Error('segments가 비어있습니다.');

    const ffmpegPath = resolveFfmpegPath();
    if (!ffmpegPath) throw new Error('ffmpeg 바이너리 경로를 찾을 수 없습니다(ffmpeg-static 설치 상태를 확인하세요).');

    const buffer = await mergeSegmentsToMp3(segments, ffmpegPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

    await store.set(`${jobId}/result.mp3`, arrayBuffer);
    await store.set(`${jobId}/status`, JSON.stringify({ status: 'done' }));
  } catch (err) {
    const message = err instanceof Error ? err.message : '오디오 병합 중 알 수 없는 오류가 발생했습니다.';
    await store.set(`${jobId}/status`, JSON.stringify({ status: 'error', message }));
  }
};
