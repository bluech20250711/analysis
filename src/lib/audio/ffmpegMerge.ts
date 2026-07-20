import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { MergeSegment } from './types';

// Google Cloud TTS 기본 출력(24kHz)에 맞춘 병합 결과물 샘플레이트.
const OUTPUT_SAMPLE_RATE = 24000;

function runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg가 코드 ${code}로 종료됐습니다: ${stderr.slice(-2000)}`));
    });
  });
}

// segments를 순서대로 이어붙여 하나의 MP3 버퍼로 만든다.
// clip은 임시 파일로 기록해 입력으로 사용하고, silence/tone은 ffmpeg의 lavfi 가상 입력을
// 그대로 사용해(무음/신호음 파일을 미리 만들 필요 없음) 하나의 filter_complex concat으로 합친다.
// ffmpegPath는 호출자가 주입한다 — 배포 환경(Netlify Function)에서는 ffmpeg-static이 제공하는
// 바이너리 경로를, 로컬 개발/테스트에서는 시스템 PATH의 ffmpeg를 그대로 넘기면 된다.
export async function mergeSegmentsToMp3(segments: MergeSegment[], ffmpegPath: string): Promise<Buffer> {
  if (segments.length === 0) throw new Error('mergeSegmentsToMp3: segments가 비어있습니다.');

  const workDir = await mkdtemp(path.join(tmpdir(), 'csat-audio-merge-'));
  try {
    const inputArgs: string[] = [];
    const filterInputs: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.kind === 'clip') {
        const filePath = path.join(workDir, `clip-${i}.mp3`);
        await writeFile(filePath, Buffer.from(seg.audioBase64, 'base64'));
        inputArgs.push('-i', filePath);
      } else if (seg.kind === 'silence') {
        inputArgs.push('-f', 'lavfi', '-t', String(seg.seconds), '-i', `anullsrc=r=${OUTPUT_SAMPLE_RATE}:cl=mono`);
      } else {
        inputArgs.push(
          '-f',
          'lavfi',
          '-t',
          String(seg.seconds),
          '-i',
          `sine=frequency=1000:sample_rate=${OUTPUT_SAMPLE_RATE}`,
        );
      }
      filterInputs.push(`[${i}:a]`);
    }

    const filterComplex = `${filterInputs.join('')}concat=n=${segments.length}:v=0:a=1[outa]`;
    const outputPath = path.join(workDir, 'output.mp3');

    await runFfmpeg(ffmpegPath, [
      ...inputArgs,
      '-filter_complex',
      filterComplex,
      '-map',
      '[outa]',
      '-ar',
      String(OUTPUT_SAMPLE_RATE),
      '-ac',
      '1',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '96k',
      '-y',
      outputPath,
    ]);

    return await readFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
