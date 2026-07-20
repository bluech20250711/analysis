import type { TtsLineRequest, TtsLineResult } from './tts/types';
import type { MergeSegment } from './audio/types';
import type { ExamSet, ListeningItem, ReadingItem } from './types';

// 브라우저에서 Netlify Functions를 호출하는 얇은 fetch 래퍼 모음.
// Gemini 호출과 달리 이 함수들은 서버 리소스(ffmpeg, jszip, fontkit)가 필요한 작업이라
// 서버리스 함수를 거친다(설계스펙 9절 BYOK — TTS 키는 요청 본문으로만 일회성 전달, 저장 안 함).

// 함수가 우리 코드에서 정상적으로 JSON 에러 응답을 반환한 경우뿐 아니라, Netlify 자체가
// (실행시간 초과·크래시 등으로) HTML/텍스트 에러 페이지를 대신 반환하는 경우에도 화면에
// "OO 생성에 실패했습니다."라는 말만 보이고 실제 원인이 사라지지 않도록, 상태 코드와
// 응답 본문 일부를 최대한 그대로 붙여서 보여준다.
async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const statusInfo = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;

  let bodyText: string;
  try {
    bodyText = await response.text();
  } catch {
    return `${fallback} (${statusInfo})`;
  }

  try {
    const parsed = JSON.parse(bodyText) as { error?: string };
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return `${parsed.error} (${statusInfo})`;
    }
  } catch {
    // JSON이 아닌 응답(Netlify 자체 에러 페이지 등) — 아래에서 원문 일부를 그대로 보여준다.
  }

  const snippet = bodyText.trim().slice(0, 300);
  return snippet ? `${fallback} (${statusInfo}): ${snippet}` : `${fallback} (${statusInfo})`;
}

export async function startAudioClipGeneration(
  jobId: string,
  ttsApiKey: string,
  lines: TtsLineRequest[],
): Promise<void> {
  const response = await fetch('/.netlify/functions/generate-audio-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, apiKey: ttsApiKey, lines }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response, 'TTS 생성 요청에 실패했습니다.'));
}

export type AudioClipsPoll =
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'done'; clips: TtsLineResult[] };

export async function pollAudioClipsOnce(jobId: string): Promise<AudioClipsPoll> {
  const response = await fetch(`/.netlify/functions/get-audio-clips?jobId=${encodeURIComponent(jobId)}`);
  if (!response.ok) throw new Error(await readErrorMessage(response, 'TTS 생성 상태 조회에 실패했습니다.'));
  return (await response.json()) as AudioClipsPoll;
}

export async function pollAudioClipsUntilDone(
  jobId: string,
  { intervalMs = 3000, timeoutMs = 5 * 60 * 1000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<TtsLineResult[]> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await pollAudioClipsOnce(jobId);
    if (result.status === 'done') return result.clips;
    if (result.status === 'error') throw new Error(result.message);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('TTS 생성이 제한 시간 내에 끝나지 않았습니다.');
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
