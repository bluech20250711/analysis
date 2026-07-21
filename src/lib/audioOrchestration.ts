import { buildListeningMergePlan, buildTtsLineId } from './audio/buildMergePlan';
import type { ListeningItem } from './types';
import type { TtsLineRequest } from './tts/types';
import {
  pollAudioClipsUntilDone,
  pollMergedAudioUntilDone,
  startAudioClipGeneration,
  startAudioMerge,
} from './apiClient';

const INTRO_TEXT = '지금부터 듣기평가를 시작합니다.';
const OUTRO_TEXT = '이상으로 듣기평가를 마칩니다.';
const INTRO_CLIP_ID = 'intro';
const OUTRO_CLIP_ID = 'outro';

function buildTtsLineRequests(listening: ListeningItem[]): TtsLineRequest[] {
  const requests: TtsLineRequest[] = [
    { id: INTRO_CLIP_ID, speaker: 'Narrator', text: INTRO_TEXT },
    { id: OUTRO_CLIP_ID, speaker: 'Narrator', text: OUTRO_TEXT },
  ];

  for (const item of listening) {
    item.script.forEach((line, i) => {
      requests.push({ id: buildTtsLineId(item.number, i), speaker: line.speaker, text: line.line });
    });
  }

  return requests;
}

// 듣기 1-17번 대본을 TTS로 합성하고 신호음/정적구간과 함께 병합해 하나의 mp3 Blob으로 반환한다.
// 개별 클립 생성(generate-audio-background)과 병합(merge-audio-background) 둘 다 Netlify
// 동기 함수의 10초 제한을 넘기기 쉬워 Background Function + 폴링 방식이다:
// generate-audio-background(클립) → get-audio-clips(폴링) → merge-audio-background(병합)
// → get-merged-audio(폴링) 순서로 진행한다.
export async function synthesizeListeningAudio(ttsApiKey: string, listening: ListeningItem[]): Promise<Blob> {
  const lineRequests = buildTtsLineRequests(listening);

  const clipsJobId = crypto.randomUUID();
  await startAudioClipGeneration(clipsJobId, ttsApiKey, lineRequests);
  const clipResults = await pollAudioClipsUntilDone(clipsJobId);
  const clipsById = new Map(clipResults.map((result) => [result.id, result.audioBase64]));

  const segments = buildListeningMergePlan({
    listening,
    clipsById,
    introClipId: INTRO_CLIP_ID,
    outroClipId: OUTRO_CLIP_ID,
  });

  const mergeJobId = crypto.randomUUID();
  await startAudioMerge(mergeJobId, clipsJobId, segments);
  return pollMergedAudioUntilDone(mergeJobId);
}
