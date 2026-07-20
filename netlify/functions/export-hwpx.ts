import { existsSync } from 'node:fs';
import type { Handler } from '@netlify/functions';
import { buildFullExamHwpx } from '../../src/lib/hwpx/buildHwpx';
import { HWPX_TEMPLATE_DIR, SECTION0_PATH } from '../../src/lib/hwpx/paths';
import type { ListeningItem, ReadingItem } from '../../src/lib/types';

// 문항 JSON(듣기 1-17 + 독해 18-45)을 이언어학원 시험지 양식 HWPX로 조립한다.
// HWPX 조립은 문자열 치환 위주라 PDF와 마찬가지로 빠르며(수 초 이내) 동기 함수로 처리한다.
//
// 배포 후 templates/hwpx-template/가 실제로 함수 배포 패키지에 포함됐는지 확인하려면:
// Netlify 대시보드 → 해당 사이트 → Functions 탭 → export-hwpx → Logs에서 아래 콜드 스타트
// 로그를 확인한다(HWPX_TEMPLATE_DIR가 resolveTemplateDir로 어느 후보 경로를 찾았는지,
// section0.xml exists 여부가 그대로 찍힌다).
console.log(
  `[export-hwpx] cwd=${process.cwd()} LAMBDA_TASK_ROOT=${process.env.LAMBDA_TASK_ROOT}`,
);
console.log(`[export-hwpx] HWPX_TEMPLATE_DIR=${HWPX_TEMPLATE_DIR}`);
console.log(`[export-hwpx] SECTION0_PATH=${SECTION0_PATH} exists=${existsSync(SECTION0_PATH)}`);

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
