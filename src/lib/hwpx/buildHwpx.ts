import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { HWPX_TEMPLATE_DIR, SECTION0_PATH } from './paths';
import { renderListeningItemFragment, type ListeningFragmentData } from './listeningFragment';

// 원본 고등부.hwpx의 1번 문항 조각 경계를 찾기 위한 마커.
// (실제 텍스트를 앵커로 삼아 위치를 찾는다 — Phase 3에서 여러 문항을 다룰 때는
// 문항 번호 기반의 좀 더 일반화된 마커 탐색으로 교체될 예정)
const Q1_STEM_MARKER = '<hp:t>1. </hp:t>';
const Q2_STEM_TEXT_MARKER = '2. 대화를 듣고';

function findFragmentBounds(section0: string): { start: number; end: number } {
  const stemIdx = section0.indexOf(Q1_STEM_MARKER);
  if (stemIdx === -1) {
    throw new Error('section0.xml에서 1번 문항 마커를 찾을 수 없습니다. 템플릿이 변경되었을 수 있습니다.');
  }
  const start = section0.lastIndexOf('<hp:p ', stemIdx);
  if (start === -1) throw new Error('1번 문항의 시작 <hp:p> 태그를 찾을 수 없습니다.');

  const nextIdx = section0.indexOf(Q2_STEM_TEXT_MARKER);
  if (nextIdx === -1) {
    throw new Error('section0.xml에서 2번 문항 마커를 찾을 수 없습니다. 템플릿이 변경되었을 수 있습니다.');
  }
  const end = section0.lastIndexOf('<hp:p ', nextIdx);
  if (end === -1) throw new Error('2번 문항의 시작 <hp:p> 태그를 찾을 수 없습니다.');

  return { start, end };
}

async function addTemplateFilesToZip(zip: JSZip): Promise<void> {
  // mimetype은 반드시 압축하지 않고(STORE) 가장 먼저 추가한다.
  const mimetypeContent = await readFile(path.join(HWPX_TEMPLATE_DIR, 'mimetype'));
  zip.file('mimetype', mimetypeContent, { compression: 'STORE' });

  async function walk(dir: string, relBase: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (rel === 'mimetype') continue; // 이미 추가함
      if (rel === 'fragments' || rel.startsWith('fragments/')) continue; // 앱 자체 개발 리소스, hwpx 패키지 아님

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, rel);
      } else {
        const content = await readFile(fullPath);
        zip.file(rel, content);
      }
    }
  }

  await walk(HWPX_TEMPLATE_DIR, '');
}

export async function buildListeningPoCHwpx(data: ListeningFragmentData): Promise<Buffer> {
  await stat(SECTION0_PATH); // 템플릿 존재 확인 (없으면 명확한 에러로 실패)
  const originalSection0 = await readFile(SECTION0_PATH, 'utf-8');
  const { start, end } = findFragmentBounds(originalSection0);

  const newFragment = await renderListeningItemFragment(data);
  const newSection0 =
    originalSection0.slice(0, start) + newFragment + originalSection0.slice(end);

  const zip = new JSZip();
  await addTemplateFilesToZip(zip);
  zip.file('Contents/section0.xml', newSection0);

  const buffer = await zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' });
  return buffer;
}
