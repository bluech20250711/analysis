import type { ListeningItem } from '../types';
import type { MergeSegment } from './types';
import { SIGNAL_TONE_SECONDS, INTRO_TO_FIRST_ITEM_GAP_SECONDS, gapSecondsAfter } from './timing';

// TtsLineRequest/TtsLineResult의 id 포맷(tts/types.ts 참고: "1-0" = 1번 문항의 0번째 대사)을
// 만드는 유일한 창구 — TTS 요청을 만들 때와 병합 플랜에서 클립을 찾을 때 반드시 이 함수로 통일한다.
export function buildTtsLineId(itemNumber: number, lineIndex: number): string {
  return `${itemNumber}-${lineIndex}`;
}

export interface MergePlanInput {
  listening: ListeningItem[];
  clipsById: Map<string, string>; // TtsLineResult.id -> audioBase64 (대사 클립 + 안내멘트 클립 포함)
  introClipId?: string; // 듣기 시작 안내멘트 클립 id (clipsById에 있어야 함)
  outroClipId?: string; // 듣기 종료 안내멘트 클립 id
}

function clipSegment(clipsById: Map<string, string>, id: string): MergeSegment {
  const audioBase64 = clipsById.get(id);
  if (!audioBase64) throw new Error(`병합 플랜: 클립을 찾을 수 없습니다 (id=${id})`);
  return { kind: 'clip', audioBase64 };
}

// 듣기 1~17번 전체를 하나의 MP3로 합치기 위한 순서(MergeSegment[])를 만든다.
// 실제 ffmpeg 실행(mergeSegmentsToMp3)과는 분리되어 있어 파일 I/O 없이 순수하게 테스트 가능하다.
export function buildListeningMergePlan(input: MergePlanInput): MergeSegment[] {
  const segments: MergeSegment[] = [];
  const sorted = [...input.listening].sort((a, b) => a.number - b.number);

  if (input.introClipId) {
    segments.push(clipSegment(input.clipsById, input.introClipId));
    segments.push({ kind: 'silence', seconds: INTRO_TO_FIRST_ITEM_GAP_SECONDS });
  }

  for (const item of sorted) {
    // 16-17번처럼 공통 지문을 공유하는 문항은 script가 빈 배열일 수 있다(listeningSection.ts 참고) —
    // 그 경우 이미 앞선 문항에서 오디오가 재생됐으므로 이 문항 자체는 오디오를 추가하지 않는다.
    if (item.script.length === 0) continue;

    segments.push({ kind: 'tone', seconds: SIGNAL_TONE_SECONDS });
    item.script.forEach((_, lineIndex) => {
      segments.push(clipSegment(input.clipsById, buildTtsLineId(item.number, lineIndex)));
    });
    segments.push({ kind: 'silence', seconds: gapSecondsAfter(item) });
  }

  if (input.outroClipId) {
    segments.push(clipSegment(input.clipsById, input.outroClipId));
  }

  return segments;
}
