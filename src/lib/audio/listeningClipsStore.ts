import type { Store } from '@netlify/blobs';
import type { TtsLineResult } from '../tts/types';

// 문항별 개별 TTS 클립 생성(설계스펙 v2, 5절)의 Netlify Blobs 키 규칙을 한 곳에서 관리한다.
// audioSessionId는 문항 생성(examSet) 한 번당 발급되어 재시도해도 같은 네임스페이스를
// 가리키도록 examSetStorage.ts가 함께 저장한다 — 그렇지 않으면 서로 다른 사용자의 생성
// 시도가 같은 itemKey 키를 덮어쓸 수 있다.
export const LISTENING_CLIPS_STORE_NAME = 'listening-clips';

export type ListeningClipItemStatus = 'pending' | 'done' | 'error';

export interface ListeningClipStatusEntry {
  status: ListeningClipItemStatus;
  message?: string;
}

export type ListeningClipsStatusMap = Record<string, ListeningClipStatusEntry>;

function clipKey(audioSessionId: string, itemKey: string): string {
  return `${audioSessionId}/listening-clip-${itemKey}`;
}

function statusKey(audioSessionId: string): string {
  return `${audioSessionId}/status.json`;
}

export async function readListeningClipsStatus(
  store: Store,
  audioSessionId: string,
): Promise<ListeningClipsStatusMap> {
  const raw = await store.get(statusKey(audioSessionId), { type: 'text' });
  return raw ? (JSON.parse(raw) as ListeningClipsStatusMap) : {};
}

// 문항 생성은 항상 한 번에 하나씩만 진행되도록 설계되어 있어(오케스트레이션 쪽에서 순차
// 처리) status.json에 대한 이 read-modify-write가 동시에 겹쳐 쓰이는 경쟁 상태를 신경
// 쓸 필요가 없다.
export async function writeListeningClipItemStatus(
  store: Store,
  audioSessionId: string,
  itemKey: string,
  entry: ListeningClipStatusEntry,
): Promise<void> {
  const statusMap = await readListeningClipsStatus(store, audioSessionId);
  statusMap[itemKey] = entry;
  await store.set(statusKey(audioSessionId), JSON.stringify(statusMap));
}

export async function readListeningClip(
  store: Store,
  audioSessionId: string,
  itemKey: string,
): Promise<TtsLineResult[] | null> {
  const raw = await store.get(clipKey(audioSessionId, itemKey), { type: 'text' });
  return raw ? (JSON.parse(raw) as TtsLineResult[]) : null;
}

// 문항 하나(또는 인트로/아웃트로)가 성공했을 때만 호출한다 — 실패 시에는 이 키를 쓰지 않고
// writeListeningClipItemStatus로 상태만 'error'로 남긴다.
export async function writeListeningClip(
  store: Store,
  audioSessionId: string,
  itemKey: string,
  clips: TtsLineResult[],
): Promise<void> {
  await store.set(clipKey(audioSessionId, itemKey), JSON.stringify(clips));
}
