import { useState } from 'react';
import ApiKeySettings from './components/ApiKeySettings';
import ExamOptionsForm from './components/ExamOptionsForm';
import GenerationProgress, { type ProgressStep } from './components/GenerationProgress';
import DownloadPanel from './components/DownloadPanel';
import { getGeminiApiKey, getTtsApiKey, hasGeminiApiKey } from './lib/apiKeyStorage';
import { generateExamSet, type GenerationStage } from './lib/gemini';
import { requestHwpx, requestPdf } from './lib/apiClient';
import { synthesizeListeningAudio } from './lib/audioOrchestration';
import type { ExamSet, ExamOptions } from './lib/types';

type View = 'main' | 'settings';
type PipelineStage = GenerationStage | 'audio' | 'hwpx' | 'pdf';

const DEFAULT_OPTIONS: ExamOptions = {
  yearLevel: '2027학년도 수능 대비 / 고3 6월 모의평가 수준',
  ebsLinked: false,
  grade: '고3',
  academyBranch: '이언어학원 나루관',
};

const STEP_LABELS: Record<PipelineStage, string> = {
  listening: '듣기 1~17번 문항 생성',
  'reading-18-34': '독해 18~34번 문항 생성',
  'reading-35-45': '독해 35~45번 문항 생성',
  audio: '듣기 음성 합성 + 오디오 병합',
  hwpx: '시험지 HWPX 생성',
  pdf: '시험지 PDF 생성',
  done: '완료',
};

function buildSteps(includeAudio: boolean): ProgressStep[] {
  const keys: PipelineStage[] = ['listening', 'reading-18-34', 'reading-35-45'];
  if (includeAudio) keys.push('audio');
  keys.push('hwpx', 'pdf', 'done');
  return keys.map((key) => ({ key, label: STEP_LABELS[key] }));
}

function App() {
  const [view, setView] = useState<View>(hasGeminiApiKey() ? 'main' : 'settings');
  const [notice, setNotice] = useState<string | null>(null);
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [examSet, setExamSet] = useState<ExamSet | null>(null);
  const [hwpxBlob, setHwpxBlob] = useState<Blob | undefined>();
  const [pdfBlob, setPdfBlob] = useState<Blob | undefined>();
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>();
  const [audioSkippedReason, setAudioSkippedReason] = useState<string | undefined>();

  const loading = stage !== null && stage !== 'done';
  const ttsApiKey = getTtsApiKey();
  const steps = buildSteps(!!ttsApiKey);

  const handleGenerate = async (options: ExamOptions) => {
    if (!hasGeminiApiKey()) {
      setNotice('API 키를 먼저 입력해주세요.');
      setView('settings');
      return;
    }

    setNotice(null);
    setError(null);
    setExamSet(null);
    setHwpxBlob(undefined);
    setPdfBlob(undefined);
    setAudioBlob(undefined);
    setAudioSkippedReason(undefined);
    setStage('listening');

    try {
      const geminiApiKey = getGeminiApiKey()!;
      const generated = await generateExamSet(geminiApiKey, options, setStage);
      setExamSet(generated);

      if (ttsApiKey) {
        setStage('audio');
        try {
          const audio = await synthesizeListeningAudio(ttsApiKey, generated.listening);
          setAudioBlob(audio);
        } catch (audioErr) {
          setAudioSkippedReason(
            `듣기 MP3 생성에 실패했습니다: ${audioErr instanceof Error ? audioErr.message : audioErr}`,
          );
        }
      } else {
        setAudioSkippedReason('TTS API 키가 없어 듣기 MP3 생성을 건너뛰었습니다. (API 키 설정 화면에서 입력 가능)');
      }

      setStage('hwpx');
      const hwpx = await requestHwpx(generated.listening, generated.reading);
      setHwpxBlob(hwpx);

      setStage('pdf');
      const pdf = await requestPdf(generated);
      setPdfBlob(pdf);

      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '문항 생성 중 오류가 발생했습니다.');
      setStage(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <h1 className="text-lg font-semibold">수능 영어영역 자동 출제 앱</h1>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setView(view === 'settings' ? 'main' : 'settings');
          }}
          className="text-sm text-blue-600 hover:underline"
        >
          {view === 'settings' ? '← 돌아가기' : 'API 키 설정'}
        </button>
      </header>

      <main className="p-6">
        {notice && (
          <div className="max-w-2xl mx-auto mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
            {notice}
          </div>
        )}

        {view === 'settings' ? (
          <ApiKeySettings
            onSaved={() => {
              setNotice(null);
              setView('main');
            }}
          />
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            <ExamOptionsForm initialOptions={DEFAULT_OPTIONS} onSubmit={handleGenerate} disabled={loading} />

            {loading && <GenerationProgress steps={steps} currentKey={stage} />}

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {examSet && (
              <div className="bg-white rounded-xl shadow p-4 space-y-3">
                <p className="font-medium">
                  생성 완료 — 듣기 {examSet.listening.length}문항 / 독해 {examSet.reading.length}문항
                </p>
                <details className="text-sm">
                  <summary className="cursor-pointer text-blue-600">전체 JSON 보기</summary>
                  <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap mt-2">
                    {JSON.stringify(examSet, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {examSet && (
              <DownloadPanel
                examSet={examSet}
                hwpxBlob={hwpxBlob}
                pdfBlob={pdfBlob}
                audioBlob={audioBlob}
                audioSkippedReason={audioSkippedReason}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
