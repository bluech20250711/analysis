import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

// merge-audio-background.ts(Background Function)가 완료될 때까지 프론트에서 폴링하는 엔드포인트.
// 사용법: GET /.netlify/functions/get-merged-audio?jobId=<merge-audio-background 호출 시 넘긴 jobId>
//   - 아직 처리 중: { status: "pending" }
//   - 실패: { status: "error", message }
//   - 완료: audio/mpeg 응답 본문으로 최종 MP3(base64)

export const handler: Handler = async (event) => {
  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'jobId 쿼리 파라미터가 필요합니다.' }) };
  }

  const store = getStore('audio-merge-jobs');
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

  const audio = await store.get(`${jobId}/result.mp3`, { type: 'arrayBuffer' });
  if (!audio) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
    body: Buffer.from(audio).toString('base64'),
    isBase64Encoded: true,
  };
};
