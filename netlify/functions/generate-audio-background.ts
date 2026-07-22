import type { BackgroundHandler } from '@netlify/functions';
import {
  LISTENING_CLIPS_STORE_NAME,
  writeListeningClip,
  writeListeningClipItemStatus,
} from '../../src/lib/audio/listeningClipsStore';
import { synthesizeLines } from '../../src/lib/tts/googleTts';
import { connectBlobsForBackgroundFunction, getJobStore } from '../../src/lib/netlifyBlobsStore';
import type { TtsLineRequest } from '../../src/lib/tts/types';

// 설계스펙 v2(5절, 문항별 개별 생성): 예전에는 듣기 1-17번 전체 대사를 한 번에 이어서
// 합성하다 보니 한 문항만 실패해도 배치 전체를 다시 생성해야 했다. 이 함수는 이제 문항
// 하나(또는 인트로/아웃트로)만 처리하는 독립된 단위로 호출된다 — 문항별 결과는
// listeningClipsStore.ts가 관리하는 Netlify Blobs(`listening-clips` 스토어)에
// audioSessionId로 스코프된 키로 저장되어, 특정 문항이 실패해도 이미 성공한 다른 문항의
// 클립에는 전혀 영향을 주지 않는다.
//
// 문항 하나의 대사 줄 수는 보통 몇 줄뿐이라 Netlify 동기 함수의 10초 제한 안에 충분히
// 끝날 가능성이 높지만, 대사가 유독 많은 문항(예: 3인 대화)까지 안전하게 처리하기 위해
// 기존에 검증된 Background Function + Netlify Blobs + 폴링 패턴을 그대로 유지한다.
interface RequestBody {
  audioSessionId: string;
  itemKey: string; // "1".."17" 또는 "intro"/"outro"
  apiKey: string;
  lines: TtsLineRequest[];
}

export const handler: BackgroundHandler = async (event) => {
  // Background Function은 일반 동기 함수와 달리 Netlify Blobs 컨텍스트가 자동으로
  // 주입되지 않을 수 있다(실사용 중 MissingBlobsEnvironmentError 확인) — getStore 호출 전에
  // 반드시 먼저 연결한다.
  connectBlobsForBackgroundFunction(event);

  const { audioSessionId, itemKey, apiKey, lines } = JSON.parse(event.body ?? '{}') as RequestBody;
  const store = getJobStore(LISTENING_CLIPS_STORE_NAME);

  try {
    if (!audioSessionId) throw new Error('audioSessionId가 필요합니다.');
    if (!itemKey) throw new Error('itemKey가 필요합니다.');
    if (!apiKey || !apiKey.trim()) throw new Error('apiKey가 필요합니다.');
    if (!Array.isArray(lines) || lines.length === 0) throw new Error('lines 배열이 비어있습니다.');

    const clips = await synthesizeLines(apiKey, lines);

    await writeListeningClip(store, audioSessionId, itemKey, clips);
    await writeListeningClipItemStatus(store, audioSessionId, itemKey, { status: 'done' });
  } catch (err) {
    // apiKey 값 자체는 err 메시지에 포함되지 않음 (googleTts.ts에서 마스킹 처리)
    const message = err instanceof Error ? err.message : 'TTS 생성 중 알 수 없는 오류가 발생했습니다.';
    await writeListeningClipItemStatus(store, audioSessionId, itemKey, { status: 'error', message });
  }
};
