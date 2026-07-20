import type { TtsLineRequest, TtsLineResult } from './tts/types';
import type { MergeSegment } from './audio/types';
import type { ExamSet, ListeningItem, ReadingItem } from './types';

// 브라우저에서 Netlify Functions를 호출하는 얇은 fetch 래퍼 모음.
// Gemini 호출과 달리 이 함수들은 서버 리소스(ffmpeg, jszip, fontkit)가 필요한 작업이라
// 서버리스 함수를 거친다(설계스펙 9절 BYOK — TTS 키는 요청 본문으로만 일회성 전달, 저장 안 함).

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return typeof body.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export async function requestAudioClips(ttsApiKey: string, lines: TtsLineRequest[]): Promise<TtsLineResult[]> {
  const response = await fetch('/.netlify/functions/generate-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: ttsApiKey, lines }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response, 'TTS 생성에 실패했습니다.'));
  const body = (await response.json()) as { clips: TtsLineResult[] };
  return body.clips;
}

export async function startAudioMerge(jobId: string, segments: MergeSegment[]): Promise<void> {
  const response = await fetch('/.netlify/functions/merge-audio-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, segments }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response, '오디오 병합 요청에 실패했습니다.'));
}

export type MergedAudioPoll =
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'done'; audioBlob: Blob };

export async function pollMergedAudioOnce(jobId: string): Promise<MergedAudioPoll> {
  const response = await fetch(`/.netlify/functions/get-merged-audio?jobId=${encodeURIComponent(jobId)}`);
  if (!response.ok) throw new Error(await readErrorMessage(response, '오디오 병합 상태 조회에 실패했습니다.'));

  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('audio/mpeg')) {
    return { status: 'done', audioBlob: await response.blob() };
  }
  return (await response.json()) as MergedAudioPoll;
}

export async function pollMergedAudioUntilDone(
  jobId: string,
  { intervalMs = 3000, timeoutMs = 5 * 60 * 1000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<Blob> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await pollMergedAudioOnce(jobId);
    if (result.status === 'done') return result.audioBlob;
    if (result.status === 'error') throw new Error(result.message);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('오디오 병합이 제한 시간 내에 끝나지 않았습니다.');
}

export async function requestHwpx(listening: ListeningItem[], reading: ReadingItem[]): Promise<Blob> {
  const response = await fetch('/.netlify/functions/export-hwpx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listening, reading }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response, 'HWPX 생성에 실패했습니다.'));
  return response.blob();
}

export async function requestPdf(examSet: ExamSet): Promise<Blob> {
  const response = await fetch('/.netlify/functions/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examSet }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response, 'PDF 생성에 실패했습니다.'));
  return response.blob();
}
