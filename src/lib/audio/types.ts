// 듣기평가 MP3 병합 파이프라인(Phase 5, 설계스펙 5절)의 조각 단위.
export type MergeSegment =
  | { kind: 'clip'; audioBase64: string } // TTS로 합성된 대사/안내멘트 클립(mp3, base64)
  | { kind: 'silence'; seconds: number } // 문항 사이 정적 구간
  | { kind: 'tone'; seconds: number }; // 문항 시작을 알리는 신호음
