// 듣기평가 MP3 병합 파이프라인(Phase 5, 설계스펙 5절)의 조각 단위.
//
// MergeSegment는 실제 오디오 바이트(audioBase64)를 담고 있어 ffmpeg 병합(mergeSegmentsToMp3)
// 입력으로만 쓰인다 — 서버(Netlify Function) 안에서만 만들어지고 소비된다.
//
// MergeSegmentSpec은 클립을 id로만 참조하는 경량 버전으로, 브라우저 → merge-audio-background
// 요청 본문(JSON)에 실리는 "전송용" 형태다. 듣기 전체 분량의 TTS 오디오를 base64로 통째로
// JSON에 실어 보내면 AWS Lambda 비동기 invoke 페이로드 한도(과거 256KB, 현재도 1MB)를 쉽게
// 넘겨 플랫폼 단에서 "HTTP 500 Internal Error"로 거부당하는 문제가 실사용 중 발견됐다 — 실제
// 오디오 데이터는 이미 generate-audio-background가 Netlify Blobs(audio-clip-jobs 스토어)에
// 저장해둔 것을 merge-audio-background가 clipsJobId로 직접 읽어오도록 분리해 해결했다.
export type MergeSegment =
  | { kind: 'clip'; audioBase64: string } // TTS로 합성된 대사/안내멘트 클립(mp3, base64)
  | { kind: 'silence'; seconds: number } // 문항 사이 정적 구간
  | { kind: 'tone'; seconds: number }; // 문항 시작을 알리는 신호음

export type MergeSegmentSpec =
  | { kind: 'clip'; clipId: string } // TtsLineResult.id (또는 인트로/아웃로 클립 id) 참조
  | { kind: 'silence'; seconds: number }
  | { kind: 'tone'; seconds: number };
