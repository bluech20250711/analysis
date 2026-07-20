import type { Speaker } from '../types';

export interface TtsLineRequest {
  id: string; // 호출자가 결과를 다시 매칭할 때 쓰는 식별자 (예: "1-0" = 1번 문항의 0번째 대사)
  speaker: Speaker;
  text: string;
  speakingRate?: number;
}

export interface TtsLineResult {
  id: string;
  audioBase64: string; // MP3, base64 인코딩
}
