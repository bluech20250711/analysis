import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Netlify Functions 배포 환경에서 이 함수가 위치한 파일의 실제 컴파일 결과 경로와
// 함수 실행 시점의 process.cwd()가 항상 일치한다고 보장할 수 없다(번들러 내부 구조에
// 따라 달라짐 — 실사용 중 ENOENT로 발견). 그래서 여러 후보 base 디렉터리를 순서대로
// 시도해 실제로 templates/ 자산이 존재하는 첫 번째 경로를 채택한다.
//
// currentFileUrl은 호출하는 쪽(예: hwpx/paths.ts)의 import.meta.url을 넘겨받는다 —
// 이 모듈 자신의 위치가 아니라 호출자의 위치를 기준으로 후보를 만들어야 하기 때문.
//
// ⚠️ Netlify는 함수를 esbuild로 CJS로 번들링하는데, esbuild는 CJS 출력에서 import.meta를
// 빈 객체로 치환한다 — 그 결과 배포 환경에서는 import.meta.url이 undefined가 되어
// fileURLToPath(undefined)가 TypeError를 던진다(실사용 중 "path 인자는 string/URL이어야
// 한다" 에러로 발견). 이 값이 유효하지 않을 수 있다는 전제로 방어적으로 처리하고,
// process.cwd() 및 AWS Lambda가 항상 주입하는 LAMBDA_TASK_ROOT(함수 코드 루트, 보통
// /var/task)를 추가 후보로 사용한다.
function tryResolveDirFromFileUrl(currentFileUrl: string | undefined): string | null {
  if (!currentFileUrl) return null;
  try {
    return path.dirname(fileURLToPath(currentFileUrl));
  } catch {
    return null;
  }
}

export function resolveTemplateDir(currentFileUrl: string, relativeDir: string): string {
  const currentDir = tryResolveDirFromFileUrl(currentFileUrl);

  const roots = [process.cwd(), process.env.LAMBDA_TASK_ROOT, currentDir].filter(
    (value): value is string => Boolean(value),
  );

  const candidateBases = roots.flatMap((root) => [
    root,
    path.resolve(root, '..'),
    path.resolve(root, '../..'),
    path.resolve(root, '../../..'),
    path.resolve(root, '../../../..'),
    path.resolve(root, '../../../../..'),
  ]);

  for (const base of candidateBases) {
    const candidate = path.resolve(base, relativeDir);
    if (existsSync(candidate)) return candidate;
  }

  const tried = [...new Set(candidateBases.map((base) => path.resolve(base, relativeDir)))];
  throw new Error(
    `템플릿 디렉터리를 찾을 수 없습니다: "${relativeDir}"\n` +
      `다음 경로들을 확인했지만 존재하지 않습니다(Netlify 배포라면 netlify.toml의 included_files 설정을 확인하세요):\n  - ${tried.join('\n  - ')}`,
  );
}
