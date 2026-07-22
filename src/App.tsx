import { useEffect, useState } from 'react';
import ApiKeySettings from './components/ApiKeySettings';
import ExamModeCards, { type ExamMode } from './components/ExamModeCards';
import ExamOptionsForm from './components/ExamOptionsForm';
import GenerationProgress, { type ProgressStep } from './components/GenerationProgress';
import DownloadPanel from './components/DownloadPanel';
import ListeningAudioPanel from './components/ListeningAudioPanel';
import TypeSelectionPanel from './components/TypeSelectionPanel';
import { getGeminiApiKey, getTtsApiKey, hasGeminiApiKey } from './lib/apiKeyStorage';
import { generateExamSet, type GenerationStage } from './lib/gemini';
import { requestHwpx, requestPdf, getListeningClipsStatus } from './lib/apiClient';
import {
  buildListeningClipUnits,
  collectKnownClipIds,
  generateListeningClips,
  mergeListeningAudio,
  regenerateFailedListeningClips,
  type ListeningClipUnit,
} from './lib/audioOrchestration';
import type { ListeningClipsStatusMap } from './lib/audio/listeningClipsStore';
import { loadAudioSessionId, loadExamSet, saveAudioSessionId, saveExamSet } from './lib/examSetStorage';
import type { ExamSet, ExamOptions } from './lib/types';

type View = 'main' | 'settings';
type PipelineStage = GenerationStage | 'hwpx' | 'pdf';
type RetryableStage = 'hwpx' | 'pdf';

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
  hwpx: '시험지 HWPX 생성',
  pdf: '시험지 PDF 생성',
  done: '완료',
};

function buildSteps(): ProgressStep[] {
  const keys: PipelineStage[] = ['listening', 'reading-18-34', 'reading-35-45', 'hwpx', 'pdf', 'done'];
  return keys.map((key) => ({ key, label: STEP_LABELS[key] }));
}

const steps = buildSteps();

function App() {
  const [view, setView] = useState<View>(hasGeminiApiKey() ? 'main' : 'settings');
  // 메인 화면 상단 3분기 카드(설계스펙 12절) — 카드를 고르기 전엔 아무 패널도 안 보인다.
  const [activeMode, setActiveMode] = useState<ExamMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 뒷단계(TTS/HWPX/PDF)가 실패해도 Gemini를 다시 호출하지 않고 이미 생성된 문항으로 그
  // 단계만 재시도할 수 있도록, 마지막으로 생성된 문항 JSON을 localStorage에서 복원해온다.
  const [examSet, setExamSet] = useState<ExamSet | null>(() => loadExamSet());
  const [hwpxBlob, setHwpxBlob] = useState<Blob | undefined>();
  const [pdfBlob, setPdfBlob] = useState<Blob | undefined>();
  const [hwpxFailedReason, setHwpxFailedReason] = useState<string | undefined>();
  const [pdfFailedReason, setPdfFailedReason] = useState<string | undefined>();
  const [retryingStage, setRetryingStage] = useState<RetryableStage | null>(null);

  // 설계스펙 v2(5절, 문항별 개별 생성) — 듣기 음성은 더 이상 위 파이프라인의 일부가 아니라
  // 문항별로 독립 진행되는 별도 상태다. audioSessionId는 examSet과 함께 저장되어 새로고침
  // 후에도 같은 Netlify Blobs 네임스페이스를 가리킨다. examSet이 캐시에서 복원된 경우
  // audioSessionId/listeningClipUnits도 그 자리에서 동기적으로 함께 복원한다(handleGenerate로
  // 새로 생성할 때는 그쪽에서 자체적으로 새로 만들어 덮어씀).
  const [audioSessionId, setAudioSessionId] = useState<string | null>(() => {
    if (!examSet) return null;
    const existing = loadAudioSessionId();
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    saveAudioSessionId(fresh);
    return fresh;
  });
  const [listeningClipUnits, setListeningClipUnits] = useState<ListeningClipUnit[]>(() =>
    examSet ? buildListeningClipUnits(examSet.listening) : [],
  );
  const [clipStatusMap, setClipStatusMap] = useState<ListeningClipsStatusMap>({});
  const [clipGenerating, setClipGenerating] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>();
  const [audioMerging, setAudioMerging] = useState(false);
  const [mergeFailedReason, setMergeFailedReason] = useState<string | undefined>();

  const loading = stage !== null && stage !== 'done';
  const ttsApiKey = getTtsApiKey();

  // 캐시에서 복원된 examSet/audioSessionId가 있으면, 지금까지의 문항별 생성 상태를 한 번만
  // 서버에서 읽어와 화면에 반영한다(마운트 시 1회 — Netlify Function 호출이라 useState
  // 초기화 함수 안에서는 할 수 없는 비동기 작업).
  useEffect(() => {
    if (!examSet || !audioSessionId || !ttsApiKey) return;
    let cancelled = false;
    getListeningClipsStatus(audioSessionId)
      .then((statusMap) => {
        if (!cancelled) setClipStatusMap(statusMap);
      })
      .catch(() => {
        // 상태 조회 실패는 조용히 무시 — 사용자는 그래도 재생성/병합 버튼으로 이어갈 수 있음
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gemini 재호출 없이 문항 데이터로만 동작 — 실패해도 계속 다음 문항으로 진행한다.
  const runClipGeneration = async (sessionId: string, apiKey: string, units: ListeningClipUnit[]) => {
    if (units.length === 0) return;
    setClipGenerating(true);
    try {
      await generateListeningClips(sessionId, apiKey, units, (itemKey, entry) => {
        setClipStatusMap((prev) => ({ ...prev, [itemKey]: entry }));
      });
    } catch (err) {
      // generateListeningClips 자체는 문항별 에러를 삼키고 계속 진행하므로, 여기 도달하는
      // 경우는 네트워크 등 더 근본적인 문제 — 조용히 무시하지 않고 콘솔에 남긴다.
      console.warn('[App] 듣기 음성 생성 중 예기치 못한 오류:', err);
    } finally {
      setClipGenerating(false);
    }
  };

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
    setHwpxFailedReason(undefined);
    setPdfFailedReason(undefined);
    setListeningClipUnits([]);
    setClipStatusMap({});
    setAudioBlob(undefined);
    setMergeFailedReason(undefined);
    setStage('listening');

    try {
      const geminiApiKey = getGeminiApiKey()!;
      const generated = await generateExamSet(geminiApiKey, options, setStage);
      setExamSet(generated);
      saveExamSet(generated);

      const sessionId = crypto.randomUUID();
      saveAudioSessionId(sessionId);
      setAudioSessionId(sessionId);
      const units = buildListeningClipUnits(generated.listening);
      setListeningClipUnits(units);

      // 문항별 음성 생성은 HWPX/PDF와 독립적으로 진행한다(병합은 별도 버튼으로만 실행되므로
      // 이 파이프라인의 완료를 기다릴 필요가 없다) — await하지 않고 백그라운드로 흘려보낸다.
      if (ttsApiKey) {
        void runClipGeneration(sessionId, ttsApiKey, units);
      }

      setStage('hwpx');
      try {
        const hwpx = await requestHwpx(generated.listening, generated.reading);
        setHwpxBlob(hwpx);
      } catch (hwpxErr) {
        setHwpxFailedReason(hwpxErr instanceof Error ? hwpxErr.message : String(hwpxErr));
      }

      setStage('pdf');
      try {
        const pdf = await requestPdf(generated);
        setPdfBlob(pdf);
      } catch (pdfErr) {
        setPdfFailedReason(pdfErr instanceof Error ? pdfErr.message : String(pdfErr));
      }

      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '문항 생성 중 오류가 발생했습니다.');
      setStage(null);
    }
  };

  // HWPX/PDF는 이미 생성돼 있는 examSet(문항 JSON)만 다시 사용해 해당 단계만 재시도한다.
  const handleRetryHwpx = async () => {
    if (!examSet) return;
    setRetryingStage('hwpx');
    setHwpxFailedReason(undefined);
    try {
      const hwpx = await requestHwpx(examSet.listening, examSet.reading);
      setHwpxBlob(hwpx);
    } catch (hwpxErr) {
      setHwpxFailedReason(hwpxErr instanceof Error ? hwpxErr.message : String(hwpxErr));
    } finally {
      setRetryingStage(null);
    }
  };

  const handleRetryPdf = async () => {
    if (!examSet) return;
    setRetryingStage('pdf');
    setPdfFailedReason(undefined);
    try {
      const pdf = await requestPdf(examSet);
      setPdfBlob(pdf);
    } catch (pdfErr) {
      setPdfFailedReason(pdfErr instanceof Error ? pdfErr.message : String(pdfErr));
    } finally {
      setRetryingStage(null);
    }
  };

  // 실패한 문항만 골라 다시 생성한다 — 이미 성공한 문항의 클립(listening-clip-*)은 그대로 둔다.
  const handleRetryFailedClips = async () => {
    if (!audioSessionId || !ttsApiKey) return;
    const failedItemKeys = new Set(
      listeningClipUnits.filter((unit) => clipStatusMap[unit.itemKey]?.status === 'error').map((unit) => unit.itemKey),
    );
    if (failedItemKeys.size === 0) return;

    setClipGenerating(true);
    try {
      await regenerateFailedListeningClips(audioSessionId, ttsApiKey, listeningClipUnits, failedItemKeys, (itemKey, entry) => {
        setClipStatusMap((prev) => ({ ...prev, [itemKey]: entry }));
      });
    } catch (err) {
      console.warn('[App] 실패 문항 재생성 중 예기치 못한 오류:', err);
    } finally {
      setClipGenerating(false);
    }
  };

  // 17개 문항(+인트로/아웃트로) 전부 성공했을 때만 ListeningAudioPanel에서 활성화되는 버튼.
  const handleMergeAudio = async () => {
    if (!audioSessionId || !examSet) return;
    setAudioMerging(true);
    setMergeFailedReason(undefined);
    try {
      const knownClipIds = collectKnownClipIds(listeningClipUnits, clipStatusMap);
      const audio = await mergeListeningAudio(audioSessionId, examSet.listening, knownClipIds);
      setAudioBlob(audio);
    } catch (mergeErr) {
      setMergeFailedReason(mergeErr instanceof Error ? mergeErr.message : String(mergeErr));
    } finally {
      setAudioMerging(false);
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
          <div className="max-w-5xl mx-auto space-y-4">
            <ExamModeCards activeMode={activeMode} onSelect={setActiveMode} />

            {activeMode === 'by-type' && <TypeSelectionPanel />}

            {activeMode === 'full-set' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <ExamOptionsForm
                  initialOptions={DEFAULT_OPTIONS}
                  onSubmit={handleGenerate}
                  disabled={loading || retryingStage !== null}
                />

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

                {examSet && !ttsApiKey && (
                  <p className="text-sm text-gray-500">
                    TTS API 키가 없어 듣기 MP3 생성을 건너뜁니다. (API 키 설정 화면에서 입력 가능)
                  </p>
                )}

                {examSet && ttsApiKey && (
                  <ListeningAudioPanel
                    units={listeningClipUnits}
                    statusMap={clipStatusMap}
                    generating={clipGenerating}
                    merging={audioMerging}
                    mergeFailedReason={mergeFailedReason}
                    onRetryFailed={handleRetryFailedClips}
                    onMerge={handleMergeAudio}
                  />
                )}

                {examSet && (
                  <DownloadPanel
                    examSet={examSet}
                    hwpxBlob={hwpxBlob}
                    pdfBlob={pdfBlob}
                    audioBlob={audioBlob}
                    hwpxFailedReason={hwpxFailedReason}
                    pdfFailedReason={pdfFailedReason}
                    retryingStage={retryingStage}
                    onRetryHwpx={handleRetryHwpx}
                    onRetryPdf={handleRetryPdf}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
