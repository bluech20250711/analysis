import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { synthesizeLines } from '../src/lib/tts/googleTts';
import type { TtsLineRequest } from '../src/lib/tts/types';

// 사용법: npm run test:tts -- <출력폴더>
// GOOGLE_CLOUD_TTS_API_KEY를 .env에서 읽어 화자별(M/W/Narrator) 샘플 문장을
// 실제로 합성해 mp3 파일로 저장한다 (개발자가 직접 들어보고 보이스/속도를 확인하는 용도).

if (!process.env.GOOGLE_CLOUD_TTS_API_KEY) {
  console.error('❌ GOOGLE_CLOUD_TTS_API_KEY 환경변수가 없습니다. .env 파일에 설정해주세요.');
  process.exit(1);
}
const apiKey: string = process.env.GOOGLE_CLOUD_TTS_API_KEY;

const sampleLines: TtsLineRequest[] = [
  { id: 'M', speaker: 'M', text: 'Hello, this is a test of the male voice for the listening section.' },
  { id: 'W', speaker: 'W', text: 'Hi, this is a test of the female voice for the listening section.' },
  {
    id: 'Narrator',
    speaker: 'Narrator',
    text: 'This is a test of the narrator voice used for questions sixteen and seventeen.',
  },
];

async function main() {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('사용법: tsx scripts/test-tts.ts <출력폴더>');
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  console.log('[test-tts] 화자별 샘플 음성 합성 중...');
  const clips = await synthesizeLines(apiKey, sampleLines);

  for (const clip of clips) {
    const filePath = path.join(outDir, `${clip.id}.mp3`);
    await writeFile(filePath, Buffer.from(clip.audioBase64, 'base64'));
    console.log(`✅ ${filePath}`);
  }
}

main().catch((err) => {
  console.error('❌ TTS 생성 실패:', err);
  process.exit(1);
});
