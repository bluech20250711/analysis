import { extractTopics, generateItemUnit } from './gemini';
import { buildGenerationUnits, type GenerationUnit } from './generationUnits';
import type { ExamOptions, ListeningItem, ReadingItem } from './types';

// 설계스펙 v2 — 문항별 개별 생성 오케스트레이션(듣기 음성 생성의 audioOrchestration.ts와
// 동일한 사고방식). 문항(또는 짝 그룹) 하나씩 순차로 Gemini를 호출하고, 하나가 실패해도
// 나머지는 계속 진행한다. 실패한 번호만 다시 골라 재시도할 수 있다.

export type ItemGenerationStatus = 'pending' | 'done' | 'error';

export interface ItemStatusEntry {
  status: ItemGenerationStatus;
  message?: string;
}

// 유닛(짝 그룹 포함)이 완료될 때마다 그 유닛에 속한 모든 번호에 동일한 상태를 반영한다.
export type ItemStatusCallback = (numbers: number[], entry: ItemStatusEntry) => void;

export interface GeneratedItems {
  listening: ListeningItem[];
  reading: ReadingItem[];
}

// units를 순차로 하나씩 생성한다 — Gemini 호출도 TTS와 마찬가지로 한 번에 여러 개를
// 동시에 보내지 않는다(레이트리밋/일관성 고려). 특정 유닛이 실패해도 나머지 유닛 생성은
// 계속 진행하며, 독해 유닛이 성공할 때마다 그 소재를 usedTopics에 누적해 다음 독해 유닛의
// "중복 소재 방지" 프롬프트에 반영한다.
export async function generateExamItems(
  apiKey: string,
  options: ExamOptions,
  units: GenerationUnit[],
  onStatusChange: ItemStatusCallback,
  usedTopicsSoFar: string[] = [],
): Promise<GeneratedItems> {
  const listening: ListeningItem[] = [];
  const reading: ReadingItem[] = [];
  const usedTopics = [...usedTopicsSoFar];

  for (const unit of units) {
    try {
      const items = await generateItemUnit(apiKey, options, unit, usedTopics);
      if (unit.kind === 'listening') {
        listening.push(...(items as ListeningItem[]));
      } else {
        const readingItems = items as ReadingItem[];
        reading.push(...readingItems);
        usedTopics.push(...extractTopics(readingItems));
      }
      onStatusChange(unit.numbers, { status: 'done' });
    } catch (err) {
      const message = err instanceof Error ? err.message : '문항 생성 중 알 수 없는 오류가 발생했습니다.';
      onStatusChange(unit.numbers, { status: 'error', message });
    }
  }

  return { listening, reading };
}

// "실패만 재생성" — failedNumbers만으로 유닛을 다시 구성해(짝 그룹은 buildGenerationUnits가
// 자동으로 다시 묶어줌) 순차 생성한다. 이미 성공한 다른 문항에는 전혀 영향이 없다.
export async function regenerateFailedItems(
  apiKey: string,
  options: ExamOptions,
  failedNumbers: number[],
  onStatusChange: ItemStatusCallback,
  usedTopicsSoFar: string[] = [],
): Promise<GeneratedItems> {
  const units = buildGenerationUnits(failedNumbers);
  return generateExamItems(apiKey, options, units, onStatusChange, usedTopicsSoFar);
}
