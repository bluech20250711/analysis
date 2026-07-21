import { stream } from '@netlify/functions';
import { getJobStore } from '../../src/lib/netlifyBlobsStore';

// merge-audio-background.ts(Background Function)가 완료될 때까지 프론트에서 폴링하는 엔드포인트.
// 사용법: GET /.netlify/functions/get-merged-audio?jobId=<merge-audio-background 호출 시 넘긴 jobId>
//   - 아직 처리 중: { status: "pending" }
//   - 실패: { status: "error", message }
//   - 완료: audio/mpeg 응답 본문으로 최종 MP3
//
// ⚠️ 완성된 MP3를 base64로 인코딩해 통째로 응답 본문에 담아 반환했더니, 듣기 전체 분량
// 기준 MP3가 수 MB를 넘기기 쉬운데(base64 인코딩으로 약 1.33배 더 커짐) Netlify Functions의
// 동기(버퍼링) 응답 페이로드 한도(약 6MB, AWS Lambda 동기 invoke 응답 한도를 그대로 물려받음)를
// 넘겨 "Function.ResponseSizeTooLarge"로 실패했다(실사용 중 발견). @netlify/functions가
// 정확히 이런 대용량 응답을 위해 제공하는 stream()으로 감싸 응답을 스트리밍하면 이 한도를
// 우회할 수 있다(Netlify 공식 문서가 대용량 파일 응답의 권장 해법으로 명시). Netlify Blobs의
// Store.get(key, { type: 'stream' })이 반환하는 스트림을 그대로 응답 body로 흘려보내
// 전체 MP3를 메모리에 한 번에 올리지도 않는다.
export const handler = stream(async (event) => {
  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'jobId 쿼리 파라미터가 필요합니다.' }) };
  }

  const store = getJobStore('audio-merge-jobs');
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

  const audioStream = await store.get(`${jobId}/result.mp3`, { type: 'stream' });
  if (!audioStream) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
    body: audioStream,
  };
});
