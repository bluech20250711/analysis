import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

// generate-audio-background.ts(Background Function)가 완료될 때까지 프론트에서 폴링하는
// 엔드포인트. get-merged-audio.ts와 동일한 패턴.
// 사용법: GET /.netlify/functions/get-audio-clips?jobId=<generate-audio-background 호출 시 넘긴 jobId>
//   - 아직 처리 중: { status: "pending" }
//   - 실패: { status: "error", message }
//   - 완료: { status: "done", clips: TtsLineResult[] }

export const handler: Handler = async (event) => {
  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'jobId 쿼리 파라미터가 필요합니다.' }) };
  }

  const store = getStore('audio-clip-jobs');
  const statusRaw = await store.get(`${jobId}/status`, { type: 'text' });

  if (!statusRaw) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    };
  }

  const status = JSON.parse(statusRaw) as { status: 'done' | 'error'; message?: string };
  if (status.status === 'error') {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(status) };
  }

  const clipsRaw = await store.get(`${jobId}/clips.json`, { type: 'text' });
  if (!clipsRaw) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done', clips: JSON.parse(clipsRaw) }),
  };
};
