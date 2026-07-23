import { buildDirectionLineId, buildListeningMergePlan, buildTtsLineId } from './audio/buildMergePlan';
import type { ListeningClipsStatusMap } from './audio/listeningClipsStore';
import { numberToKoreanReading } from './koreanNumber';
import type { ListeningItem } from './types';
import type { TtsLineRequest } from './tts/types';
import {
  getListeningClipsStatus,
  pollMergedAudioUntilDone,
  startAudioMerge,
  startListeningClipGeneration,
} from './apiClient';

// 설계스펙 v2(5절, 문항별 개별 생성) — 예전에는 듣기 1-17번 전체 대사를 한 번에 이어서
// 생성하다 하나만 실패해도 전체를 다시 만들어야 했다. 이제 문항(또는 인트로/아웃트로) 하나가
// "독립된 생성 단위"이고, ffmpeg 병합은 17개 문항이 모두 완료됐을 때 사용자가 직접 누르는
// 별도 버튼으로만 실행된다(자동 병합하지 않음).

export const INTRO_ITEM_KEY = 'intro';
export const OUTRO_ITEM_KEY = 'outro';
const INTRO_TEXT = '지금부터 듣기평가를 시작합니다.';
const OUTRO_TEXT = '이상으로 듣기평가를 마칩니다.';

export interface ListeningClipUnit {
  itemKey: string; // "1".."17" 또는 "intro"/"outro"
  lines: TtsLineRequest[];
}

// "1번" 대신 "일번"처럼 숫자를 한글로 읽어 TTS가 아라비아 숫자를 영어식으로 읽거나
// 어색하게 읽는 문제를 방지한다(실제 수능 방송과 동일한 방식).
function directionTextFor(item: ListeningItem): string {
  return `${numberToKoreanReading(item.number)}번, ${item.instruction}`;
}

// 문항별로 독립적으로 생성할 단위 목록을 순서대로(인트로 → 1~17번 중 실제 대사가 있는 문항 →
// 아웃트로) 만든다. 16-17번처럼 공통 지문이라 script가 빈 문항은 생성 대상에서 제외한다
// (병합 플랜도 동일하게 건너뛴다 — buildMergePlan.ts 참고). 화면에는 1~17번만 표시하지만
// 인트로/아웃트로도 동일한 생성/재시도 로직을 그대로 타도록 이 목록에 포함시킨다.
//
// 각 유닛의 대사 맨 앞에는 "N번, {instruction}" 디렉션 안내가 항상 먼저 온다(실제
// 수능처럼 화자 음성과 무관하게 고정된 Narrator 목소리로 통일). 16번은 담화가 시작되기
// 전에 16번과 17번 지시문을 이어서 안내한다 — 17번은 지문을 공유해 별도 생성 단위가
// 없으므로, 17번의 디렉션도 16번 유닛에 함께 포함시켜야 놓치지 않는다.
export function buildListeningClipUnits(listening: ListeningItem[]): ListeningClipUnit[] {
  const sorted = [...listening].sort((a, b) => a.number - b.number);
  const byNumber = new Map(sorted.map((item) => [item.number, item]));
  const units: ListeningClipUnit[] = [
    { itemKey: INTRO_ITEM_KEY, lines: [{ id: INTRO_ITEM_KEY, speaker: 'Narrator', text: INTRO_TEXT }] },
  ];

  for (const item of sorted) {
    if (item.script.length === 0) continue;

    const item17 = item.number === 16 ? byNumber.get(17) : undefined;
    const directionText = item17
      ? `${directionTextFor(item)} ${directionTextFor(item17)}`
      : directionTextFor(item);

    units.push({
      itemKey: String(item.number),
      lines: [
        { id: buildDirectionLineId(item.number), speaker: 'Narrator', text: directionText },
        ...item.script.map((line, i) => ({
          id: buildTtsLineId(item.number, i),
          speaker: line.speaker,
          text: line.line,
        })),
      ],
    });
  }

  units.push({ itemKey: OUTRO_ITEM_KEY, lines: [{ id: OUTRO_ITEM_KEY, speaker: 'Narrator', text: OUTRO_TEXT }] });

  return units;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilItemResolved(
  audioSessionId: string,
  itemKey: string,
  { intervalMs = 2000, timeoutMs = 2 * 60 * 1000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<ListeningClipsStatusMap[string]> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const statusMap = await getListeningClipsStatus(audioSessionId);
    const entry = statusMap[itemKey];
    if (entry && entry.status !== 'pending') return entry;
    await sleep(intervalMs);
  }
  throw new Error(`문항(${itemKey}) 음성 생성이 제한 시간 내에 끝나지 않았습니다.`);
}

// 문항(또는 인트로/아웃트로) 하나를 생성 요청하고, 완료(성공/실패)될 때까지 폴링한다.
// Background Function + Netlify Blobs + 폴링 패턴은 그대로 유지하되 단위를 "전체"에서
// "문항 하나"로 좁혔다 — 하나가 실패해도 나머지 문항의 이미 생성된 클립에는 영향이 없다.
async function generateOneListeningClip(
  audioSessionId: string,
  ttsApiKey: string,
  unit: ListeningClipUnit,
): Promise<ListeningClipsStatusMap[string]> {
  await startListeningClipGeneration(audioSessionId, unit.itemKey, ttsApiKey, unit.lines);
  return pollUntilItemResolved(audioSessionId, unit.itemKey);
}

export type ListeningClipStatusCallback = (itemKey: string, entry: ListeningClipsStatusMap[string]) => void;

// 전달된 units를 순서대로 하나씩(동시 생성 없음 — Google Cloud TTS 분당 요청 제한 고려)
// 생성한다. 특정 단위가 실패해도 나머지 단위 생성은 계속 진행한다. 호출자가 이미 완료된
// 단위를 걸러서 넘기면(App.tsx가 status를 보고 판단) 불필요한 재생성을 피할 수 있다.
export async function generateListeningClips(
  audioSessionId: string,
  ttsApiKey: string,
  units: ListeningClipUnit[],
  onStatusChange: ListeningClipStatusCallback,
): Promise<void> {
  for (const unit of units) {
    const entry = await generateOneListeningClip(audioSessionId, ttsApiKey, unit);
    onStatusChange(unit.itemKey, entry);
  }
}

// "실패만 재생성" — units 중 failedItemKeys에 해당하는 것만 골라 순차로 다시 생성한다.
// 이미 성공한 문항의 클립(listening-clip-*)은 건드리지 않는다.
export async function regenerateFailedListeningClips(
  audioSessionId: string,
  ttsApiKey: string,
  units: ListeningClipUnit[],
  failedItemKeys: Set<string>,
  onStatusChange: ListeningClipStatusCallback,
): Promise<void> {
  const targets = units.filter((unit) => failedItemKeys.has(unit.itemKey));
  await generateListeningClips(audioSessionId, ttsApiKey, targets, onStatusChange);
}

// units 중 상태 맵을 기준으로 "완료(done)"가 아직 아닌 것만 골라 knownClipIds(병합 검증용
// id 집합)를 만든다. done인 단위의 lines id만 모으면 되므로 실제 오디오 내용은 필요 없다.
export function collectKnownClipIds(units: ListeningClipUnit[], statusMap: ListeningClipsStatusMap): Set<string> {
  const ids = new Set<string>();
  for (const unit of units) {
    if (statusMap[unit.itemKey]?.status === 'done') {
      for (const line of unit.lines) ids.add(line.id);
    }
  }
  return ids;
}

// 17개 문항(+인트로/아웃트로) 전부 성공했을 때만 호출한다 — 명시적으로 "듣기평가 mp3로
// 병합" 버튼을 눌러야 실행된다(설계스펙 v2, 자동 병합하지 않음). knownClipIds는 실제
// 오디오 없이 "이 id의 클립이 존재한다"만 검증하는 용도라 완료된 units만으로 구성하면 된다.
export async function mergeListeningAudio(
  audioSessionId: string,
  listening: ListeningItem[],
  knownClipIds: Set<string>,
): Promise<Blob> {
  const segments = buildListeningMergePlan({
    listening,
    knownClipIds,
    introClipId: INTRO_ITEM_KEY,
    outroClipId: OUTRO_ITEM_KEY,
  });

  const mergeJobId = crypto.randomUUID();
  await startAudioMerge(mergeJobId, audioSessionId, segments);
  return pollMergedAudioUntilDone(mergeJobId);
}
