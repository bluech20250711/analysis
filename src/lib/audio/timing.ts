import type { ListeningItem } from '../types';

// 설계스펙 5절 "병합 파이프라인(ffmpeg)": 순서는
// [듣기 안내멘트] → [문항1 신호음] → [1번 대본] → [정적 구간] → [문항2 신호음] → ...
//
// ⚠️ 아래 초 단위 값은 설계스펙이 예시로 제시한 범위("짧은 문항 12~15초 / 16-17번 이후 20초 등")를
// 그대로 채택한 잠정값이다. 설계스펙 스스로도 "정확한 초 단위는 최신 평가원 공식 시간
// 배분표를 참고해 개발 단계에서 확정"하라고 명시하므로, 실제 서비스에 쓰기 전 공식 자료로
// 검증이 필요하다.
export const SIGNAL_TONE_SECONDS = 1;
export const STANDARD_GAP_SECONDS = 15;
export const PAIR_1617_GAP_SECONDS = 20;
export const INTRO_TO_FIRST_ITEM_GAP_SECONDS = 2;

// 각 문항의 대본 재생이 끝난 뒤 다음 신호음까지의 정적 구간 길이.
// 16-17번은 공통 지문(16번 쪽에만 script가 있고 17번은 비어 있음 — listeningSection.ts 참고)이므로
// pairGroupId만으로 판단하면 16/17번 어느 쪽이 실제로 오디오를 갖고 있는지와 무관하게 올바르게 적용된다.
export function gapSecondsAfter(item: ListeningItem): number {
  return item.pairGroupId === '16-17' ? PAIR_1617_GAP_SECONDS : STANDARD_GAP_SECONDS;
}
