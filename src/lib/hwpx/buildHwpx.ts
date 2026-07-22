import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import type { ListeningItem, ReadingItem } from '../types';
import { HWPX_TEMPLATE_DIR, SECTION0_PATH } from './paths';
import { renderListeningItemFragment, type ListeningFragmentData } from './listeningFragment';
import { buildListeningSectionXml } from './listeningSection';
import { buildReadingSectionXml } from './readingSection';

// 원본 고등부.hwpx의 1번 문항 조각 경계를 찾기 위한 마커.
// (실제 텍스트를 앵커로 삼아 위치를 찾는다 — Phase 3에서 여러 문항을 다룰 때는
// 문항 번호 기반의 좀 더 일반화된 마커 탐색으로 교체될 예정)
const Q1_STEM_MARKER = '<hp:t>1. </hp:t>';
const Q2_STEM_TEXT_MARKER = '2. 대화를 듣고';

// 듣기 섹션 전체(1~17번)의 시작/끝 마커. 끝 마커는 17번의 실제(top-level) 마지막
// 선택지 문단 — 각주 내부의 "선택지해석" 블록에도 같은 문구가 나올 수 있어
// lastIndexOf로 문서상 가장 마지막(=top-level) 위치를 찾는다.
const LISTENING_SECTION_END_MARKER = '⑤ indoor herb gardens';

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

function findListeningSectionBounds(section0: string): { start: number; end: number } {
  const stemIdx = section0.indexOf(Q1_STEM_MARKER);
  if (stemIdx === -1) {
    throw new Error('section0.xml에서 1번 문항 마커를 찾을 수 없습니다. 템플릿이 변경되었을 수 있습니다.');
  }
  const start = section0.lastIndexOf('<hp:p ', stemIdx);
  if (start === -1) throw new Error('1번 문항의 시작 <hp:p> 태그를 찾을 수 없습니다.');

  const endMarkerIdx = section0.lastIndexOf(LISTENING_SECTION_END_MARKER);
  if (endMarkerIdx === -1) {
    throw new Error('section0.xml에서 17번 문항 마지막 선택지 마커를 찾을 수 없습니다.');
  }
  const end = section0.indexOf('</hp:p>', endMarkerIdx) + '</hp:p>'.length;
  if (end === -1) throw new Error('17번 문항의 종료 </hp:p> 태그를 찾을 수 없습니다.');

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

// 듣기 1~17번 전체를 실제 ExamSet 데이터로 교체한 hwpx를 생성한다.
// 독해 18~45번은 실제 이언어학원 템플릿에 해당 구간이 없어(Phase 2 분석 결과) 아직 미지원.
export async function buildListeningExamHwpx(listening: ListeningItem[]): Promise<Buffer> {
  await stat(SECTION0_PATH);
  const originalSection0 = await readFile(SECTION0_PATH, 'utf-8');
  const { start, end } = findListeningSectionBounds(originalSection0);

  const newListeningXml = await buildListeningSectionXml(listening);
  const newSection0 = originalSection0.slice(0, start) + newListeningXml + originalSection0.slice(end);

  const zip = new JSZip();
  await addTemplateFilesToZip(zip);
  zip.file('Contents/section0.xml', newSection0);

  return zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' });
}

// 원본 문서 맨 끝의 "정답" 라벨 문단 — 독해 섹션은 이 라벨 앞(듣기 뒤)에 삽입해야 한다.
// (이전 버전은 </hs:sec> 바로 앞에 삽입해 "정답" 라벨 뒤에 붙는 순서 오류가 있었음)
const TAIL_LABEL_MARKER = '<hp:t>정답</hp:t>';

// 독해(18-45번) 섹션 PoC: 원본 문서(표지+듣기 1-17번)는 그대로 두고,
// 문서 끝의 "정답" 라벨 앞에 새 독해 섹션을 추가한다. 문항들은 순서대로 이어붙이기만
// 하면 되는데, 우리 템플릿에 이미 있는 진짜 다단(hp:colPr, NEWSPAPER 2단) 설정이 문서
// 전체에 적용되어 있어 HWP가 자동으로 좌/우 컬럼에 배분한다(표 기반 2단 구현 불필요 — CLAUDE.md 참고).
// 실제 이언어학원 독해 템플릿이 없어 처음부터 새로 구성한 레이아웃이다.
export async function buildReadingSectionPoCHwpx(readingSectionXml: string): Promise<Buffer> {
  await stat(SECTION0_PATH);
  const originalSection0 = await readFile(SECTION0_PATH, 'utf-8');

  const tailLabelIdx = originalSection0.lastIndexOf(TAIL_LABEL_MARKER);
  if (tailLabelIdx === -1) throw new Error('section0.xml에서 "정답" 라벨 문단을 찾을 수 없습니다.');
  const insertAt = originalSection0.lastIndexOf('<hp:p ', tailLabelIdx);
  if (insertAt === -1) throw new Error('"정답" 라벨의 시작 <hp:p> 태그를 찾을 수 없습니다.');

  const newSection0 =
    originalSection0.slice(0, insertAt) + readingSectionXml + originalSection0.slice(insertAt);

  const zip = new JSZip();
  await addTemplateFilesToZip(zip);
  zip.file('Contents/section0.xml', newSection0);

  return zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' });
}

function insertReadingSectionBeforeTailLabel(section0: string, readingSectionXml: string): string {
  const tailLabelIdx = section0.lastIndexOf(TAIL_LABEL_MARKER);
  if (tailLabelIdx === -1) throw new Error('section0.xml에서 "정답" 라벨 문단을 찾을 수 없습니다.');
  const insertAt = section0.lastIndexOf('<hp:p ', tailLabelIdx);
  if (insertAt === -1) throw new Error('"정답" 라벨의 시작 <hp:p> 태그를 찾을 수 없습니다.');

  return section0.slice(0, insertAt) + readingSectionXml + section0.slice(insertAt);
}

// Phase 3 완료: 듣기 1-17번 + 독해 18-45번 45문항 전체를 하나의 hwpx로 조립한다.
// 듣기 섹션은 원본 1-17번 위치를 그대로 교체하고, 독해 섹션은 문서 끝 "정답" 라벨 앞에 삽입한다.
//
// mode: 'strict'(기본값, "모의고사 1세트") — 45문항 중 하나라도 빠지면 에러로 실패.
//       'partial'("모의고사 유형별" 부분 시험지) — 없는 문항(짝 그룹은 그룹 단위)은 건너뛰고
//       실제로 생성된 문항만으로 시험지를 조립한다.
export async function buildFullExamHwpx(
  listening: ListeningItem[],
  reading: ReadingItem[],
  mode: 'strict' | 'partial' = 'strict',
): Promise<Buffer> {
  await stat(SECTION0_PATH);
  const originalSection0 = await readFile(SECTION0_PATH, 'utf-8');

  const { start, end } = findListeningSectionBounds(originalSection0);
  const newListeningXml = await buildListeningSectionXml(listening, mode);
  const withListening = originalSection0.slice(0, start) + newListeningXml + originalSection0.slice(end);

  const readingSectionXml = buildReadingSectionXml(reading, mode);
  const newSection0 = insertReadingSectionBeforeTailLabel(withListening, readingSectionXml);

  const zip = new JSZip();
  await addTemplateFilesToZip(zip);
  zip.file('Contents/section0.xml', newSection0);

  return zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' });
}
