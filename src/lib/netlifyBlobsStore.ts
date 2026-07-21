import { connectLambda, getStore, type Store } from '@netlify/blobs';

// Netlify Blobs는 일반(동기) Handler 함수에서는 siteID/token이 자동으로 주입되지만,
// Background Function은 별도의 비동기 Lambda invoke 경로를 타서 이 자동 주입이 되지 않아
// "MissingBlobsEnvironmentError"가 발생하는 사례가 실사용 중 확인됐다(TTS 생성 502).
// connectLambda(event)로 한 차례 고쳤지만 재배포 후에도 동일 에러가 재현됨 — event.blobs
// 필드 자체가 Background Function 호출에는 실려오지 않을 가능성이 있어(Netlify 플랫폼
// 쪽 동작이라 코드로 직접 확인 불가), 다음 배포에서 실제 event 형태를 로그로 남겨
// 원인을 확정할 수 있도록 진단 로그를 추가했다.
export function connectBlobsForBackgroundFunction(event: unknown): void {
  const record = event as Record<string, unknown> | null | undefined;
  const blobs = record?.blobs;

  console.log(
    `[netlifyBlobsStore] event.blobs 존재 여부=${typeof blobs === 'string' && blobs.length > 0} eventKeys=${
      record ? Object.keys(record).join(',') : 'null'
    }`,
  );

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
// NETLIFY_BLOBS_TOKEN(Personal Access Token, User settings → Applications → New access
// token에서 발급)을 직접 등록해야 한다. 이 토큰이 없으면 Background Function에서
// Netlify Blobs를 안정적으로 쓸 방법이 현재로선 없다(플랫폼 쪽 자동 주입 이슈).
export function getJobStore(name: string): Store {
  const siteID = process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;

  if (siteID && token) {
    console.log(`[netlifyBlobsStore] SITE_ID+NETLIFY_BLOBS_TOKEN으로 수동 설정된 스토어 사용: ${name}`);
    return getStore({ name, siteID, token });
  }

  try {
    return getStore(name);
  } catch (err) {
    if (err instanceof Error && err.name === 'MissingBlobsEnvironmentError') {
      throw new Error(
        `${err.message} — Background Function에서는 Netlify Blobs 컨텍스트가 자동 주입되지 않을 수 있습니다. ` +
          `Netlify 대시보드 → User settings → Applications에서 Personal Access Token을 발급한 뒤, ` +
          `이 사이트의 환경변수로 NETLIFY_BLOBS_TOKEN을 등록하고 재배포해주세요.`,
        { cause: err },
      );
    }
    throw err;
  }
}
