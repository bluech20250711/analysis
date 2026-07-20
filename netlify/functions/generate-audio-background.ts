import type { BackgroundHandler } from '@netlify/functions';
import { synthesizeLines } from '../../src/lib/tts/googleTts';
import { connectBlobsForBackgroundFunction, getJobStore } from '../../src/lib/netlifyBlobsStore';
import type { TtsLineRequest, TtsLineResult } from '../../src/lib/tts/types';

// 개별 TTS 클립 생성도 문항 수가 많으면(Google Cloud TTS 분당 요청 제한을 고려해 순차
// 처리하다 보니 문항당 0.5~2초씩 누적) Netlify 동기 함수의 10초 실행 제한을 쉽게 넘긴다
// (실사용 중 504 Gateway Timeout으로 확인됨). merge-audio-background.ts와 동일한
// 패턴(Background Function + Netlify Blobs + 폴링)으로 전환한다.
interface RequestBody {
  jobId: string;
  apiKey: string;
  lines: TtsLineRequest[];
}

export const handler: BackgroundHandler = async (event) => {
  // Background Function은 일반 동기 함수와 달리 Netlify Blobs 컨텍스트가 자동으로
  // 주입되지 않을 수 있다(실사용 중 MissingBlobsEnvironmentError 확인) — getStore 호출 전에
  // 반드시 먼저 연결한다.
  connectBlobsForBackgroundFunction(event);

  const { jobId, apiKey, lines } = JSON.parse(event.body ?? '{}') as RequestBody;
  const store = getJobStore('audio-clip-jobs');

  try {
    if (!jobId) throw new Error('jobId가 필요합니다.');
    if (!apiKey || !apiKey.trim()) throw new Error('apiKey가 필요합니다.');
    if (!Array.isArray(lines) || lines.length === 0) throw new Error('lines 배열이 비어있습니다.');

    const clips: TtsLineResult[] = await synthesizeLines(apiKey, lines);

    await store.set(`${jobId}/clips.json`, JSON.stringify(clips));
    await store.set(`${jobId}/status`, JSON.stringify({ status: 'done' }));
  } catch (err) {
    // apiKey 값 자체는 err 메시지에 포함되지 않음 (googleTts.ts에서 마스킹 처리)
    const message = err instanceof Error ? err.message : 'TTS 생성 중 알 수 없는 오류가 발생했습니다.';
    await store.set(`${jobId}/status`, JSON.stringify({ status: 'error', message }));
  }
};
