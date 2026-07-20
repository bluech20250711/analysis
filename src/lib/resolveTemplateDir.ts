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
export function resolveTemplateDir(currentFileUrl: string, relativeDir: string): string {
  const currentDir = path.dirname(fileURLToPath(currentFileUrl));

  const candidateBases = [
    process.cwd(),
    currentDir,
    path.resolve(currentDir, '..'),
    path.resolve(currentDir, '../..'),
    path.resolve(currentDir, '../../..'),
    path.resolve(currentDir, '../../../..'),
    path.resolve(currentDir, '../../../../..'),
  ];

  for (const base of candidateBases) {
    const candidate = path.resolve(base, relativeDir);
    if (existsSync(candidate)) return candidate;
  }

  const tried = candidateBases.map((base) => path.resolve(base, relativeDir)).join('\n  - ');
  throw new Error(
    `템플릿 디렉터리를 찾을 수 없습니다: "${relativeDir}"\n` +
      `다음 경로들을 확인했지만 존재하지 않습니다(Netlify 배포라면 netlify.toml의 included_files 설정을 확인하세요):\n  - ${tried}`,
  );
}
