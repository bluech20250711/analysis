import type { Handler } from '@netlify/functions';
import { LISTENING_CLIPS_STORE_NAME, readListeningClipsStatus } from '../../src/lib/audio/listeningClipsStore';
import { getJobStore } from '../../src/lib/netlifyBlobsStore';

// generate-audio-background.ts(문항별 Background Function)의 진행 상태를 한 번의 호출로
// 전체(최대 17개 문항 + 인트로/아웃트로) 조회하는 폴링 엔드포인트. 문항마다 따로 폴링하지
// 않고 status.json 하나를 통째로 반환해 프론트가 그리드 형태로 한 번에 렌더링할 수 있게 한다.
// 사용법: GET /.netlify/functions/get-listening-clips-status?audioSessionId=...
// 응답: { [itemKey: string]: { status: 'pending'|'done'|'error', message? } } — 아직 시작하지
// 않은 항목은 응답에 아예 없을 수 있다(프론트에서 '대기' 취급).

export const handler: Handler = async (event) => {
  const audioSessionId = event.queryStringParameters?.audioSessionId;
  if (!audioSessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'audioSessionId 쿼리 파라미터가 필요합니다.' }) };
  }

  const store = getJobStore(LISTENING_CLIPS_STORE_NAME);
  const statusMap = await readListeningClipsStatus(store, audioSessionId);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(statusMap),
  };
};
