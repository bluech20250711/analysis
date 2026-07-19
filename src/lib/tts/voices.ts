import type { Speaker } from '../types';

// 설계스펙 5절: Google Cloud TTS Chirp3-HD 보이스 중 남/여 각 1종 고정 배정,
// 16-17번(1인 담화)은 Narrator 전용 보이스 별도 배정.
// ⚠️ 아래 보이스명은 설계스펙에 예시로 제시된 이름이다 — 실제 사용 전
// Google Cloud 콘솔의 최신 TTS 보이스 목록에서 유효성을 반드시 확인할 것.
export const VOICE_MAP: Record<Speaker, { languageCode: string; name: string }> = {
  M: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Charon' },
  W: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Kore' },
  Narrator: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Puck' },
};

// 수능 듣기 표준 속도(약 145~155 wpm)에 맞춘 재생 속도 배율.
// Chirp3-HD 보이스는 SSML <prosody rate> 태그를 지원하지 않으므로,
// audioConfig.speakingRate(합성 API 전역 파라미터)로 속도를 조절한다.
export const DEFAULT_SPEAKING_RATE = 0.95;
