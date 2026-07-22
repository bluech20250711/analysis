import type { ListeningItem } from '../types';
import type { MergeSegment, MergeSegmentSpec } from './types';
import { SIGNAL_TONE_SECONDS, INTRO_TO_FIRST_ITEM_GAP_SECONDS, gapSecondsAfter } from './timing';

// TtsLineRequest/TtsLineResult의 id 포맷(tts/types.ts 참고: "1-0" = 1번 문항의 0번째 대사)을
// 만드는 유일한 창구 — TTS 요청을 만들 때와 병합 플랜에서 클립을 찾을 때 반드시 이 함수로 통일한다.
export function buildTtsLineId(itemNumber: number, lineIndex: number): string {
  return `${itemNumber}-${lineIndex}`;
}

// 클립 id("1-0", "intro", "outro")로부터 그 클립이 속한 문항 단위 키("1", "intro", "outro")를
// 역산한다. merge-audio-background.ts가 병합 플랜(segments)만 보고 Netlify Blobs에서 어떤
// listening-clip-{itemKey} 키들을 읽어와야 하는지 알아낼 때 사용한다(설계스펙 v2 — 문항별
// 개별 생성/저장).
export function itemKeyFromClipId(clipId: string): string {
  if (clipId === 'intro' || clipId === 'outro') return clipId;
  const dashIndex = clipId.indexOf('-');
  return dashIndex === -1 ? clipId : clipId.slice(0, dashIndex);
}

export interface MergePlanInput {
  listening: ListeningItem[];
  // 실제 오디오 바이트는 담지 않고, 이 id의 클립이 이미 생성되어 있는지만 검증하는 용도.
  // (문항별 개별 생성 구조에서는 병합 버튼을 누르는 시점에 모든 문항이 이미 완료 상태이므로
  // 클라이언트가 각 문항의 TtsLineRequest id 목록만으로 이 집합을 구성할 수 있다 — 실제
  // 오디오 내용은 서버가 병합 시점에 Blobs에서 직접 읽어온다.)
  knownClipIds: Set<string>;
  introClipId?: string; // 듣기 시작 안내멘트 클립 id (knownClipIds에 있어야 함)
  outroClipId?: string; // 듣기 종료 안내멘트 클립 id
}

function clipSegmentSpec(knownClipIds: Set<string>, id: string): MergeSegmentSpec {
  if (!knownClipIds.has(id)) throw new Error(`병합 플랜: 클립을 찾을 수 없습니다 (id=${id})`);
  return { kind: 'clip', clipId: id };
}

// 듣기 1~17번 전체를 하나의 MP3로 합치기 위한 순서(MergeSegmentSpec[])를 만든다.
// 실제 오디오 바이트는 담지 않고 클립 id만 참조하는 경량 스펙이다 — 브라우저에서 서버로
// 전송해도 페이로드 크기 문제가 없다(위 types.ts 주석 참고). 실제 ffmpeg 실행
// (mergeSegmentsToMp3)과는 완전히 분리되어 있어 파일 I/O 없이 순수하게 테스트 가능하다.
export function buildListeningMergePlan(input: MergePlanInput): MergeSegmentSpec[] {
  const segments: MergeSegmentSpec[] = [];
  const sorted = [...input.listening].sort((a, b) => a.number - b.number);

  if (input.introClipId) {
    segments.push(clipSegmentSpec(input.knownClipIds, input.introClipId));
    segments.push({ kind: 'silence', seconds: INTRO_TO_FIRST_ITEM_GAP_SECONDS });
  }

  for (const item of sorted) {
    // 16-17번처럼 공통 지문을 공유하는 문항은 script가 빈 배열일 수 있다(listeningSection.ts 참고) —
    // 그 경우 이미 앞선 문항에서 오디오가 재생됐으므로 이 문항 자체는 오디오를 추가하지 않는다.
    if (item.script.length === 0) continue;

    segments.push({ kind: 'tone', seconds: SIGNAL_TONE_SECONDS });
    item.script.forEach((_, lineIndex) => {
      segments.push(clipSegmentSpec(input.knownClipIds, buildTtsLineId(item.number, lineIndex)));
    });
    segments.push({ kind: 'silence', seconds: gapSecondsAfter(item) });
  }

  if (input.outroClipId) {
    segments.push(clipSegmentSpec(input.knownClipIds, input.outroClipId));
  }

  return segments;
}

// MergeSegmentSpec[](클립 id만 참조하는 경량 스펙)을 실제 오디오 바이트가 채워진
// MergeSegment[]로 변환한다. merge-audio-background.ts가 Netlify Blobs에서 클립 데이터를
// 직접 읽어온 뒤(clipsById) 이 함수로 병합 직전에 해석(resolve)한다.
export function resolveMergeSegments(specs: MergeSegmentSpec[], clipsById: Map<string, string>): MergeSegment[] {
  return specs.map((spec) => {
    if (spec.kind !== 'clip') return spec;
    const audioBase64 = clipsById.get(spec.clipId);
    if (!audioBase64) throw new Error(`병합: 클립을 찾을 수 없습니다 (id=${spec.clipId})`);
    return { kind: 'clip', audioBase64 };
  });
}
