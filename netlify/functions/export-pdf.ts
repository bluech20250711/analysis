import { existsSync } from 'node:fs';
import type { Handler } from '@netlify/functions';
import { buildExamPdf } from '../../src/lib/pdf/buildPdf';
import { FONT_BOLD_PATH, FONT_REGULAR_PATH } from '../../src/lib/pdf/paths';
import type { ExamSet } from '../../src/lib/types';

// Phase 6: 문항 JSON(ExamSet)을 표지 + 2단 문제지 + 정답/해설 섹션 PDF로 렌더링한다.
// PDF 생성 자체는 브라우저 없이(fontkit 기반) 순수 JS로 처리되어 ffmpeg 병합과 달리
// Background Function이 필요할 만큼 느리지 않다(45문항 기준 1초 미만) — 동기 함수로 충분.
//
// 배포 후 templates/pdf-template/가 실제로 함수 배포 패키지에 포함됐는지 확인하려면:
// Netlify 대시보드 → 해당 사이트 → Functions 탭 → export-pdf → Logs에서 아래 콜드 스타트
// 로그를 확인한다.
console.log(`[export-pdf] FONT_REGULAR_PATH=${FONT_REGULAR_PATH} exists=${existsSync(FONT_REGULAR_PATH)}`);
console.log(`[export-pdf] FONT_BOLD_PATH=${FONT_BOLD_PATH} exists=${existsSync(FONT_BOLD_PATH)}`);

interface RequestBody {
  examSet: ExamSet;
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

  if (!parsed.examSet) {
    return { statusCode: 400, body: JSON.stringify({ error: 'examSet이 필요합니다.' }) };
  }

  try {
    const buffer = await buildExamPdf(parsed.examSet);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/pdf' },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF 생성 중 알 수 없는 오류가 발생했습니다.';
    return { statusCode: 502, body: JSON.stringify({ error: message }) };
  }
};
