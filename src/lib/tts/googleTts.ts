import { DEFAULT_SPEAKING_RATE, VOICE_MAP } from './voices';
import type { TtsLineRequest, TtsLineResult } from './types';

const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

interface GoogleTtsResponse {
  audioContent?: string;
  error?: { message?: string };
}

export async function synthesizeLine(apiKey: string, request: TtsLineRequest): Promise<TtsLineResult> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Google Cloud TTS API 키가 없습니다.');
  }

  const voice = VOICE_MAP[request.speaker];
  const speakingRate = request.speakingRate ?? DEFAULT_SPEAKING_RATE;

  const response = await fetch(`${TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: request.text },
      voice: { languageCode: voice.languageCode, name: voice.name },
      audioConfig: { audioEncoding: 'MP3', speakingRate },
    }),
  });

  const body = (await response.json()) as GoogleTtsResponse;

  if (!response.ok || !body.audioContent) {
    // 에러 메시지에 apiKey가 노출되지 않도록 URL 대신 상태 코드/메시지만 포함한다.
    const detail = body.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`TTS 합성 실패 (id=${request.id}): ${detail}`);
  }

  return { id: request.id, audioBase64: body.audioContent };
}

export async function synthesizeLines(
  apiKey: string,
  requests: TtsLineRequest[],
): Promise<TtsLineResult[]> {
  const results: TtsLineResult[] = [];
  for (const req of requests) {
    // Google Cloud TTS 분당 요청 제한을 고려해 순차 처리(병렬화는 필요 시 추후 조정).
    results.push(await synthesizeLine(apiKey, req));
  }
  return results;
}
