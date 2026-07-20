import type { Handler } from '@netlify/functions';
import { synthesizeLines } from '../../src/lib/tts/googleTts';
import type { TtsLineRequest } from '../../src/lib/tts/types';

// 설계스펙 9절(BYOK): 사용자의 Google Cloud TTS 키는 저장하지 않고,
// 이 요청 처리 중에만 일회성으로 사용한다.
interface RequestBody {
  apiKey: string;
  lines: TtsLineRequest[];
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

  const { apiKey, lines } = parsed;

  if (!apiKey || !apiKey.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'apiKey가 필요합니다.' }) };
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'lines 배열이 비어있습니다.' }) };
  }

  try {
    const clips = await synthesizeLines(apiKey, lines);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clips }),
    };
  } catch (err) {
    // apiKey 값 자체는 err 메시지에 포함되지 않음 (googleTts.ts에서 마스킹 처리)
    const message = err instanceof Error ? err.message : 'TTS 생성 중 알 수 없는 오류가 발생했습니다.';
    return { statusCode: 502, body: JSON.stringify({ error: message }) };
  }
};
