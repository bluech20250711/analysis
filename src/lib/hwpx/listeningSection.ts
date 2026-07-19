import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Choice, ListeningItem } from '../types';
import { HWPX_TEMPLATE_DIR } from './paths';
import { circledNumber, escapeXmlText } from './textUtils';

// templates/hwpx-template/fragments/ 의 세 템플릿으로 듣기 1~17번 전체를 조립한다.
// - listening-line.template.xml      : 대본 한 줄(영/한 공용) 단위 조각
// - listening-item.template.xml      : 1~15번(단일 문항, endNote 구조) 공용 조각
// - listening-1617-pair.template.xml : 16-17번(공통 지문 2문항) 전용 조각
//
// 4번(그림 불일치)·10번(표 문제)은 원본 템플릿이 이미지/표를 사용하지만,
// 이번 단계에서는 표준 조각(텍스트 선택지)으로 대체한다 — 실제 이미지·표 렌더링은
// 별도 이미지 생성 파이프라인이 필요해 이번 Phase 범위 밖이다(향후 확장 필요).

const FRAGMENTS_DIR = path.join(HWPX_TEMPLATE_DIR, 'fragments');

let lineTemplate: string | null = null;
let itemTemplate: string | null = null;
let pairTemplate: string | null = null;

async function loadOnce(cache: string | null, filename: string): Promise<string> {
  if (cache !== null) return cache;
  return readFile(path.join(FRAGMENTS_DIR, filename), 'utf-8');
}

function getChoiceText(choices: Choice[], n: number): string {
  const found = choices.find((c) => c.number === n);
  if (!found) throw new Error(`선택지 ${n}번을 찾을 수 없습니다.`);
  return found.text;
}

function fillAll(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    const token = `{{${key}}}`;
    result = result.split(token).join(value);
  }
  return result;
}

function assertRemainingTokens(rendered: string, context: string): void {
  const leftover = rendered.match(/\{\{[A-Z0-9_]+\}\}|%%[A-Z0-9_]+%%/);
  if (leftover) {
    throw new Error(`${context}: 치환되지 않은 플레이스홀더가 남아있습니다 (${leftover[0]})`);
  }
}

async function renderLine(text: string): Promise<string> {
  const template = await loadOnce(lineTemplate, 'listening-line.template.xml');
  lineTemplate = template;
  return template.replace('{{TEXT}}', escapeXmlText(text));
}

async function renderScriptLines(lines: string[]): Promise<string> {
  const rendered = await Promise.all(lines.map((line) => renderLine(line)));
  return rendered.join('');
}

function validateScriptLengths(item: ListeningItem): void {
  if (item.script.length !== item.scriptKo.length) {
    throw new Error(
      `${item.number}번: script(${item.script.length}개)와 scriptKo(${item.scriptKo.length}개)의 길이가 다릅니다.`,
    );
  }
  if (item.script.length === 0) {
    throw new Error(`${item.number}번: script가 비어 있습니다.`);
  }
}

// 1~15번 공용: 단일 문항(자체 endNote 보유)
export async function renderStandardListeningItem(item: ListeningItem): Promise<string> {
  validateScriptLengths(item);
  const template = await loadOnce(itemTemplate, 'listening-item.template.xml');
  itemTemplate = template;

  const scriptEnXml = await renderScriptLines(item.script.map((s) => `${s.speaker}: ${s.line}`));
  const scriptKoXml = await renderScriptLines(item.scriptKo);

  let rendered = fillAll(template, {
    NUMBER: String(item.number),
    INSTRUCTION: escapeXmlText(item.instruction),
    ANSWER: circledNumber(item.answer),
    EXPLANATION: escapeXmlText(item.explanation),
    CHOICE_1: escapeXmlText(getChoiceText(item.choices, 1)),
    CHOICE_2: escapeXmlText(getChoiceText(item.choices, 2)),
    CHOICE_3: escapeXmlText(getChoiceText(item.choices, 3)),
    CHOICE_4: escapeXmlText(getChoiceText(item.choices, 4)),
    CHOICE_5: escapeXmlText(getChoiceText(item.choices, 5)),
  });

  rendered = rendered.replace('%%SCRIPT_LINES_EN%%', scriptEnXml);
  rendered = rendered.replace('%%SCRIPT_LINES_KO%%', scriptKoXml);

  assertRemainingTokens(rendered, `듣기 ${item.number}번`);
  return rendered;
}

// 16-17번 전용: 공통 지문(item16의 script/scriptKo만 사용)
export async function renderListeningPair1617(
  item16: ListeningItem,
  item17: ListeningItem,
): Promise<string> {
  validateScriptLengths(item16);
  const template = await loadOnce(pairTemplate, 'listening-1617-pair.template.xml');
  pairTemplate = template;

  const scriptEnXml = await renderScriptLines(item16.script.map((s) => `${s.speaker}: ${s.line}`));
  const scriptKoXml = await renderScriptLines(item16.scriptKo);

  let rendered = fillAll(template, {
    INSTRUCTION_16: escapeXmlText(item16.instruction),
    ANSWER_16: circledNumber(item16.answer),
    EXPLANATION_16: escapeXmlText(item16.explanation),
    CHOICE16_1: escapeXmlText(getChoiceText(item16.choices, 1)),
    CHOICE16_2: escapeXmlText(getChoiceText(item16.choices, 2)),
    CHOICE16_3: escapeXmlText(getChoiceText(item16.choices, 3)),
    CHOICE16_4: escapeXmlText(getChoiceText(item16.choices, 4)),
    CHOICE16_5: escapeXmlText(getChoiceText(item16.choices, 5)),
    INSTRUCTION_17: escapeXmlText(item17.instruction),
    ANSWER_17: circledNumber(item17.answer),
    EXPLANATION_17: escapeXmlText(item17.explanation),
    CHOICE17_1: escapeXmlText(getChoiceText(item17.choices, 1)),
    CHOICE17_2: escapeXmlText(getChoiceText(item17.choices, 2)),
    CHOICE17_3: escapeXmlText(getChoiceText(item17.choices, 3)),
    CHOICE17_4: escapeXmlText(getChoiceText(item17.choices, 4)),
    CHOICE17_5: escapeXmlText(getChoiceText(item17.choices, 5)),
  });

  rendered = rendered.replace('%%SCRIPT_LINES_EN%%', scriptEnXml);
  rendered = rendered.replace('%%SCRIPT_LINES_KO%%', scriptKoXml);

  assertRemainingTokens(rendered, '듣기 16-17번');
  return rendered;
}

export async function buildListeningSectionXml(listening: ListeningItem[]): Promise<string> {
  const byNumber = new Map(listening.map((item) => [item.number, item]));
  const parts: string[] = [];

  for (let n = 1; n <= 15; n++) {
    const item = byNumber.get(n);
    if (!item) throw new Error(`듣기 ${n}번 문항 데이터가 없습니다.`);
    parts.push(await renderStandardListeningItem(item));
  }

  const item16 = byNumber.get(16);
  const item17 = byNumber.get(17);
  if (!item16 || !item17) throw new Error('듣기 16-17번 문항 데이터가 없습니다.');
  parts.push(await renderListeningPair1617(item16, item17));

  return parts.join('');
}
