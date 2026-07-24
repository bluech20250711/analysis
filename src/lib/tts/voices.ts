import type { Speaker } from '../types';

// 설계스펙 5절: Google Cloud TTS Chirp3-HD 보이스 중 남/여 각 1종 고정 배정,
// 16-17번(1인 담화)은 Narrator 전용 보이스 별도 배정.
// ⚠️ 아래 보이스명은 설계스펙에 예시로 제시된 이름이다 — 실제 사용 전
// Google Cloud 콘솔의 최신 TTS 보이스 목록에서 유효성을 반드시 확인할 것.
//
// ⚠️ Narrator만 languageCode가 'ko-KR'인 이유: M/W는 듣기 대사(영어 대화) 낭독용이라
// en-US가 맞지만, Narrator는 문항 디렉션·인트로·아웃트로 등 실제로는 전부 한국어 텍스트를
// 읽는다. 예전에는 이 셋 다 'en-US-Chirp3-HD-Puck'(남성)으로 잘못 지정돼 있었다 —
// 실사용 중 실제로 들어본 뒤 (1) 남성 목소리였고 (2) 한국어를 영어 보이스로 읽고 있었다는
// 두 가지 문제가 함께 발견되어 한 번에 수정했다.
//
// 여성 Chirp3-HD 후보(공식 스타일 라벨 기준, 다른 톤 원하면 name만 교체):
//   - Aoede(Breezy, 경쾌함) — 참고 앱(Gemini API TTS 멀티 화자)이 내레이터로 쓰는 보이스와
//     이름이 같아(30개 공통 페르소나가 Cloud TTS Chirp3-HD/Gemini API TTS 양쪽에 동일하게
//     존재) 채택, 실사용 청취 후 톤 비교용 1차 실험
//   - Erinome(Clear, 또렷함) — "정확한 발음" 요구에 가장 부합, 이전에 쓰던 후보
//   - Kore(Firm, 신뢰감) — 정보 전달형, en-US 버전을 W 화자로 이미 검증해서 씀
//   - Gacrux(Mature, 성숙함) — 더 격식 있는 톤 원하면
//   - Vindemiatrix(Gentle, 부드러움) — 더 부드러운 톤 원하면
export const VOICE_MAP: Record<Speaker, { languageCode: string; name: string }> = {
  M: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Charon' },
  W: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Kore' },
  Narrator: { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Aoede' },
};

// 수능 듣기 표준 속도(약 145~155 wpm)에 맞춘 재생 속도 배율.
// Chirp3-HD 보이스는 SSML <prosody rate> 태그를 지원하지 않으므로,
// audioConfig.speakingRate(합성 API 전역 파라미터)로 속도를 조절한다.
export const DEFAULT_SPEAKING_RATE = 0.95;

// 디렉션/인트로/아웃트로(Narrator 전용) — 시험 방송 특유의 또박또박하고 차분한 속도로,
// 대화 대사(DEFAULT_SPEAKING_RATE)보다 살짝 느리게 읽는다.
export const NARRATOR_SPEAKING_RATE = 0.9;
