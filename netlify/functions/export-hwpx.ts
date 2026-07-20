import type { Handler } from '@netlify/functions';
import { buildFullExamHwpx } from '../../src/lib/hwpx/buildHwpx';
import type { ListeningItem, ReadingItem } from '../../src/lib/types';

// 문항 JSON(듣기 1-17 + 독해 18-45)을 이언어학원 시험지 양식 HWPX로 조립한다.
// HWPX 조립은 문자열 치환 위주라 PDF와 마찬가지로 빠르며(수 초 이내) 동기 함수로 처리한다.
interface RequestBody {
  listening: ListeningItem[];
  reading: ReadingItem[];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let parsed: RequestBody;
  try {
    parsed = JSON.parse(event.body ?? '{}') as RequestBody;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: '잘못된 요청 본문(JSON)입니다.' }) };
  }

  if (!Array.isArray(parsed.listening) || !Array.isArray(parsed.reading)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'listening/reading 배열이 필요합니다.' }) };
  }

  try {
    const buffer = await buildFullExamHwpx(parsed.listening, parsed.reading);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/hwp+zip' },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'HWPX 생성 중 알 수 없는 오류가 발생했습니다.';
    return { statusCode: 502, body: JSON.stringify({ error: message }) };
  }
};
