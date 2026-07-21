import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { BackgroundHandler } from '@netlify/functions';
import { resolveMergeSegments } from '../../src/lib/audio/buildMergePlan';
import { mergeSegmentsToMp3 } from '../../src/lib/audio/ffmpegMerge';
import type { MergeSegmentSpec } from '../../src/lib/audio/types';
import { connectBlobsForBackgroundFunction, getJobStore } from '../../src/lib/netlifyBlobsStore';
import type { TtsLineResult } from '../../src/lib/tts/types';

// Phase 5: 듣기 1-17번 개별 TTS 클립 + 신호음 + 정적구간을 하나의 MP3로 병합한다.
// ffmpeg 병합은 Netlify 동기 함수의 10초 제한을 넘길 수 있어 Background Function으로 분리했다
// (파일명이 "-background"로 끝나면 Netlify가 자동으로 Background Function으로 인식·최대 15분 실행).
// Background Function은 호출자에게 즉시 202를 반환하고 결과를 되돌려줄 수 없으므로,
// 완료 여부/결과물은 Netlify Blobs에 저장하고 get-merged-audio.ts가 폴링으로 제공한다.

interface RequestBody {
  jobId: string;
  clipsJobId: string; // generate-audio-background가 audio-clip-jobs 스토어에 클립을 저장할 때 쓴 jobId
  segments: MergeSegmentSpec[]; // 클립 id만 참조하는 경량 스펙 — 실제 오디오는 clipsJobId로 조회
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
//
// ⚠️ ffmpeg-static/index.js는 실행 파일 경로를 path.join(__dirname, 'ffmpeg')로 계산하고,
// install.js가 npm install 시점에 실제 바이너리를 정확히 그 자리(node_modules/ffmpeg-static/
// 폴더 안, index.js 바로 옆)에 내려받는다. esbuild가 이 패키지를 다른 코드처럼 인라인
// 번들링하면 __dirname 기준 상대 위치가 깨지거나 바이너리 자체가 배포 패키지에서 누락될 수
// 있다(실사용 중 "ffmpeg 바이너리 경로를 찾을 수 없습니다" 에러로 발견 — npm install 자체는
// Netlify 빌드 로그에서 성공이 확인됐는데도 함수 실행 시점에는 못 찾는 증상과 일치). netlify.toml의
// [functions."merge-audio-background"].external_node_modules로 node_modules/ffmpeg-static
// 폴더 전체(JS + 바이너리)를 번들링 없이 원본 그대로 복사하도록 지정해 근본 원인을 없앴고,
// 실제 배포에서 ffmpeg 병합이 끝까지 성공함을 확인했다(CLAUDE.md "오디오 병합 모듈" 절 참고).
// 아래 console.warn(실패 시)은 남겨두되, 정상 경로의 console.log(성공 시 경로 확인용)는
// 문제 해결 후 노이즈만 남아 주석 처리함 — 비슷한 문제가 재발하면 주석을 해제해 다시 확인할 수 있다.
function resolveFfmpegPath(): string | null {
  const anchor = path.join(process.cwd(), 'index.js');
  // console.log(`[merge-audio-background] resolveFfmpegPath anchor=${anchor}`);

  let ffmpegPath: unknown;
  try {
    const require = createRequire(anchor);
    ffmpegPath = require('ffmpeg-static');
  } catch (err) {
    console.warn(
      `[merge-audio-background] require('ffmpeg-static') 실패:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  if (typeof ffmpegPath !== 'string' || !ffmpegPath) {
    console.warn(`[merge-audio-background] ffmpeg-static이 유효한 경로를 반환하지 않음:`, ffmpegPath);
    return null;
  }

  const exists = existsSync(ffmpegPath);
  // console.log(`[merge-audio-background] ffmpegPath=${ffmpegPath} exists=${exists}`);
  if (!exists) return null;

  return ffmpegPath;
}

export const handler: BackgroundHandler = async (event) => {
  // Background Function은 일반 동기 함수와 달리 Netlify Blobs 컨텍스트가 자동으로
  // 주입되지 않을 수 있다(실사용 중 MissingBlobsEnvironmentError 확인) — getStore 호출 전에
  // 반드시 먼저 연결한다.
  connectBlobsForBackgroundFunction(event);

  const { jobId, clipsJobId, segments } = JSON.parse(event.body ?? '{}') as RequestBody;
  const store = getJobStore('audio-merge-jobs');

  try {
    if (!jobId) throw new Error('jobId가 필요합니다.');
    if (!clipsJobId) throw new Error('clipsJobId가 필요합니다.');
    if (!Array.isArray(segments) || segments.length === 0) throw new Error('segments가 비어있습니다.');

    const ffmpegPath = resolveFfmpegPath();
    if (!ffmpegPath) throw new Error('ffmpeg 바이너리 경로를 찾을 수 없습니다(ffmpeg-static 설치 상태를 확인하세요).');

    // 실제 오디오 바이트는 요청 본문이 아니라 generate-audio-background가 이미 저장해둔
    // audio-clip-jobs 스토어에서 직접 읽어온다 — 요청 본문에 통째로 실으면 AWS Lambda 비동기
    // invoke 페이로드 한도를 넘겨 500 Internal Error로 거부당할 수 있다(실사용 중 발견).
    const clipsStore = getJobStore('audio-clip-jobs');
    const clipsRaw = await clipsStore.get(`${clipsJobId}/clips.json`, { type: 'text' });
    if (!clipsRaw) throw new Error(`클립 데이터를 찾을 수 없습니다 (clipsJobId=${clipsJobId}).`);
    const clips = JSON.parse(clipsRaw) as TtsLineResult[];
    const clipsById = new Map(clips.map((clip) => [clip.id, clip.audioBase64]));

    const resolvedSegments = resolveMergeSegments(segments, clipsById);
    const buffer = await mergeSegmentsToMp3(resolvedSegments, ffmpegPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

    await store.set(`${jobId}/result.mp3`, arrayBuffer);
    await store.set(`${jobId}/status`, JSON.stringify({ status: 'done' }));
  } catch (err) {
    const message = err instanceof Error ? err.message : '오디오 병합 중 알 수 없는 오류가 발생했습니다.';
    await store.set(`${jobId}/status`, JSON.stringify({ status: 'error', message }));
  }
};
