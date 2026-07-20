import { connectLambda, getStore, type Store } from '@netlify/blobs';

// Netlify Blobs는 일반(동기) Handler 함수에서는 siteID/token이 자동으로 주입되지만,
// Background Function은 별도의 비동기 Lambda invoke 경로를 타서 이 자동 주입이 되지 않아
// "MissingBlobsEnvironmentError"가 발생하는 사례가 실사용 중 확인됐다(TTS 생성 502).
// @netlify/blobs가 정확히 이런 경우를 위해 제공하는 connectLambda(event)로, raw Lambda
// 이벤트에 실려오는 blobs 컨텍스트(event.blobs, x-nf-site-id 헤더 등)를 직접 연결한다.
export function connectBlobsForBackgroundFunction(event: unknown): void {
  const blobs = (event as { blobs?: unknown } | null | undefined)?.blobs;
  if (typeof blobs !== 'string' || !blobs) return;

  try {
    connectLambda(event as Parameters<typeof connectLambda>[0]);
  } catch (err) {
    console.warn('[netlifyBlobsStore] connectLambda 실패:', err instanceof Error ? err.message : err);
  }
}

// connectLambda로도 컨텍스트가 연결되지 않는 경우(Netlify 플랫폼 쪽 자동 주입이 아예
// 안 되는 경우)를 대비한 최종 방어선 — SITE_ID는 Netlify가 모든 함수에 자동으로
// 주입해주지만, token은 보안상 자동 주입되지 않으므로 사용자가 Netlify 사이트 환경변수로
// NETLIFY_BLOBS_TOKEN(Personal Access Token)을 직접 등록해야 한다.
export function getJobStore(name: string): Store {
  const siteID = process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name, siteID, token });
  }
  return getStore(name);
}
