import { useEffect, useState } from 'react';
import ApiKeySettings from './components/ApiKeySettings';
import ExamModeCards, { type ExamMode } from './components/ExamModeCards';
import ExamOptionsForm from './components/ExamOptionsForm';
import GenerationProgress, { type ProgressStep } from './components/GenerationProgress';
import ItemGenerationStatus from './components/ItemGenerationStatus';
import DownloadPanel from './components/DownloadPanel';
import ExamItemCard from './components/ExamItemCard';
import ListeningAudioPanel from './components/ListeningAudioPanel';
import TypeSelectionPanel from './components/TypeSelectionPanel';
import { getGeminiApiKey, getTtsApiKey, hasGeminiApiKey } from './lib/apiKeyStorage';
import { extractTopics } from './lib/gemini';
import {
  generateExamItems,
  regenerateFailedItems,
  regenerateItemWithEdit,
  type ItemStatusEntry,
} from './lib/examGenerationOrchestration';
import { buildGenerationUnits } from './lib/generationUnits';
import { DEFAULT_EXAM_OPTIONS } from './lib/defaultExamOptions';
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
import type { ExamSet, ExamOptions, ListeningItem, ReadingItem } from './lib/types';

type View = 'main' | 'settings';
// Gemini 문항 생성(문항별 개별 호출, ItemGenerationStatus로 표시)이 끝난 뒤 이어지는 단계만
// 여기 남는다 — 45개(또는 선택된 개수)의 개별 호출 자체는 더 이상 하나의 "stage"가 아니다.
type PipelineStage = 'hwpx' | 'pdf' | 'done';
type RetryableStage = 'hwpx' | 'pdf';

const ALL_ITEM_NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1);

const STEP_LABELS: Record<PipelineStage, string> = {
  hwpx: '시험지 HWPX 생성',
  pdf: '시험지 PDF 생성',
  done: '완료',
};

function buildSteps(): ProgressStep[] {
  const keys: PipelineStage[] = ['hwpx', 'pdf', 'done'];
  return keys.map((key) => ({ key, label: STEP_LABELS[key] }));
}

const steps = buildSteps();

// HWPX/PDF는 "필수 모드"(45문항 전체 — 하나라도 빠지면 에러)와 "있는 것만 모드"(부분
// 시험지 — 없는 문항/짝 그룹은 건너뜀) 두 가지로 조립할 수 있다. 어느 카드(1세트/유형별)에서
// 생성했는지가 아니라 실제로 45문항이 다 채워졌는지로 판단한다 — "유형별"에서 45개를 전부
// 체크해 생성해도 완전한 시험지이므로 굳이 partial로 다룰 이유가 없고, 반대로 새로고침 후
// 캐시에서 복원된 examSet처럼 생성 경로를 알 수 없는 경우에도 항상 정확하게 판단할 수 있다.
function resolveHwpxPdfMode(examSet: ExamSet): 'strict' | 'partial' {
  return examSet.listening.length === 17 && examSet.reading.length === 28 ? 'strict' : 'partial';
}

function assembleExamSet(
  listening: ListeningItem[],
  reading: ReadingItem[],
  options: ExamOptions,
  title: string,
): ExamSet {
  return {
    metadata: {
      title,
      academyBranch: options.academyBranch,
      grade: options.grade,
      createdAt: new Date().toISOString(),
    },
    listening: [...listening].sort((a, b) => a.number - b.number),
    reading: [...reading].sort((a, b) => a.number - b.number),
  };
}

function App() {
  const [view, setView] = useState<View>(hasGeminiApiKey() ? 'main' : 'settings');
  // 메인 화면 상단 3분기 카드(설계스펙 12절) — 카드를 고르기 전엔 아무 패널도 안 보인다.
  const [activeMode, setActiveMode] = useState<ExamMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 뒷단계(TTS/HWPX/PDF)가 실패해도 Gemini를 다시 호출하지 않고 이미 생성된 문항으로 그
  // 단계만 재시도할 수 있도록, 마지막으로 생성된 문항 JSON을 localStorage에서 복원해온다.
  const [examSet, setExamSet] = useState<ExamSet | null>(() => loadExamSet());
  const [hwpxBlob, setHwpxBlob] = useState<Blob | undefined>();
  const [pdfBlob, setPdfBlob] = useState<Blob | undefined>();
  const [hwpxFailedReason, setHwpxFailedReason] = useState<string | undefined>();
  const [pdfFailedReason, setPdfFailedReason] = useState<string | undefined>();
  const [retryingStage, setRetryingStage] = useState<RetryableStage | null>(null);

  // 문항별 개별 Gemini 생성(설계스펙 v2 — "모의고사 1세트"/"모의고사 유형별" 공용) 상태.
  // genNumbers는 이번에 요청한 전체 문항 번호(짝 그룹 확장 포함), genStatusMap은 번호별
  // 진행상황. 실패한 번호만 다시 골라 재시도할 수 있도록 지금까지 생성된 문항도 별도 보관한다.
  const [genNumbers, setGenNumbers] = useState<number[]>([]);
  const [genStatusMap, setGenStatusMap] = useState<Record<number, ItemStatusEntry>>({});
  const [itemGenerating, setItemGenerating] = useState(false);
  const [generatedListening, setGeneratedListening] = useState<ListeningItem[]>([]);
  const [generatedReading, setGeneratedReading] = useState<ReadingItem[]>([]);
  const [genOptions, setGenOptions] = useState<ExamOptions | null>(null);
  const [genTitle, setGenTitle] = useState<string>('모의고사');

  // 카드뷰 "문항 수정" — 번호별(짝 그룹이면 그룹 전체) 재생성 상태. 성공하면 해당 번호의
  // 항목을 지워 카드가 idle로 돌아가게 한다(ExamItemCard가 loading→undefined 전이를
  // 편집 상자 자동 닫힘 신호로 사용).
  const [editStatusMap, setEditStatusMap] = useState<Record<number, { status: 'loading' | 'error'; message?: string }>>(
    {},
  );

  // 설계스펙 v2(5절, 문항별 개별 생성) — 듣기 음성은 더 이상 위 파이프라인의 일부가 아니라
  // 문항별로 독립 진행되는 별도 상태다. audioSessionId는 examSet과 함께 저장되어 새로고침
  // 후에도 같은 Netlify Blobs 네임스페이스를 가리킨다. examSet이 캐시에서 복원된 경우
  // audioSessionId/listeningClipUnits도 그 자리에서 동기적으로 함께 복원한다(새로 생성할 때는
  // finalizeGeneratedExam이 자체적으로 새로 만들어 덮어씀).
  const [audioSessionId, setAudioSessionId] = useState<string | null>(() => {
    if (!examSet) return null;
    const existing = loadAudioSessionId();
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    saveAudioSessionId(fresh);
    return fresh;
  });
  const [listeningClipUnits, setListeningClipUnits] = useState<ListeningClipUnit[]>(() =>
    examSet ? buildListeningClipUnits(examSet.listening, examSet.metadata.grade) : [],
  );
  const [clipStatusMap, setClipStatusMap] = useState<ListeningClipsStatusMap>({});
  const [clipGenerating, setClipGenerating] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>();
  const [audioMerging, setAudioMerging] = useState(false);
  const [mergeFailedReason, setMergeFailedReason] = useState<string | undefined>();

  const loading = itemGenerating || (pipelineStage !== null && pipelineStage !== 'done') || retryingStage !== null;
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

  // 다른 카드로 전환할 때, 진행 중이 아니라면 이전 카드에서 남은 문항 생성 진행상황(번호
  // 그리드)을 지워 새 카드에서 엉뚱한 이전 결과가 보이지 않게 한다.
  const handleSelectMode = (mode: ExamMode) => {
    if (mode !== activeMode && !itemGenerating) {
      setGenNumbers([]);
      setGenStatusMap({});
    }
    setActiveMode(mode);
  };

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

  // 문항 생성이 전부 성공했을 때만 호출 — ExamSet을 조립해 캐싱하고, 문항별 음성 생성을
  // (있으면) 백그라운드로 시작한 뒤 HWPX/PDF를 순서대로 생성하고 결과 화면으로 전환한다.
  const finalizeGeneratedExam = async (
    listening: ListeningItem[],
    reading: ReadingItem[],
    options: ExamOptions,
    title: string,
  ) => {
    const generated = assembleExamSet(listening, reading, options, title);
    setExamSet(generated);
    saveExamSet(generated);

    const sessionId = crypto.randomUUID();
    saveAudioSessionId(sessionId);
    setAudioSessionId(sessionId);
    const units = buildListeningClipUnits(generated.listening, generated.metadata.grade);
    setListeningClipUnits(units);

    if (ttsApiKey && units.length > 0) {
      void runClipGeneration(sessionId, ttsApiKey, units);
    }

    // activeMode는 건드리지 않는다 — 결과 화면은 activeMode와 무관하게 examSet 유무로
    // 렌더링되므로("유형별"에서 생성해도 "1세트" 카드로 강제 전환되던 버그 수정), 사용자가
    // 어느 카드에서 생성을 시작했든 그 화면에 그대로 머문 채 결과를 확인할 수 있다.
    const mode = resolveHwpxPdfMode(generated);

    setPipelineStage('hwpx');
    try {
      const hwpx = await requestHwpx(generated.listening, generated.reading, mode);
      setHwpxBlob(hwpx);
    } catch (hwpxErr) {
      setHwpxFailedReason(hwpxErr instanceof Error ? hwpxErr.message : String(hwpxErr));
    }

    setPipelineStage('pdf');
    try {
      const pdf = await requestPdf(generated, mode);
      setPdfBlob(pdf);
    } catch (pdfErr) {
      setPdfFailedReason(pdfErr instanceof Error ? pdfErr.message : String(pdfErr));
    }

    setPipelineStage('done');
  };

  // 문항 번호 목록을 받아 그 문항들만 Gemini로 순차 생성한다 — "모의고사 1세트"(1~45 전체)와
  // "모의고사 유형별"(체크된 번호만) 양쪽이 공유하는 단일 진입점(사용자 확정: 1세트도 문항별
  // 개별 호출로 통일). 짝 문항(16-17/41-42/43-45)은 buildGenerationUnits가 자동으로 그룹
  // 전체를 포함시킨다.
  const handleGenerateItems = async (numbers: number[], options: ExamOptions, title: string) => {
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
    setPipelineStage(null);

    const units = buildGenerationUnits(numbers);
    const expandedNumbers = units.flatMap((unit) => unit.numbers).sort((a, b) => a - b);

    setGenNumbers(expandedNumbers);
    setGenStatusMap(Object.fromEntries(expandedNumbers.map((n) => [n, { status: 'pending' as const }])));
    setGeneratedListening([]);
    setGeneratedReading([]);
    setGenOptions(options);
    setGenTitle(title);
    setItemGenerating(true);

    try {
      const geminiApiKey = getGeminiApiKey()!;
      const result = await generateExamItems(geminiApiKey, options, units, (unitNumbers, entry) => {
        setGenStatusMap((prev) => {
          const next = { ...prev };
          for (const n of unitNumbers) next[n] = entry;
          return next;
        });
      });
      setGeneratedListening(result.listening);
      setGeneratedReading(result.reading);

      const succeeded = new Set([...result.listening.map((i) => i.number), ...result.reading.map((i) => i.number)]);
      const allSucceeded = expandedNumbers.every((n) => succeeded.has(n));
      if (allSucceeded) {
        await finalizeGeneratedExam(result.listening, result.reading, options, title);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '문항 생성 중 오류가 발생했습니다.');
    } finally {
      setItemGenerating(false);
    }
  };

  const handleSubmitFullSet = (options: ExamOptions) => {
    void handleGenerateItems(ALL_ITEM_NUMBERS, options, `${options.grade} 모의고사 1세트`);
  };

  // 실패한 문항 번호만 다시 골라 재생성한다 — 이미 성공한 문항은 그대로 두고 합친다.
  const handleRetryFailedItems = async () => {
    if (!genOptions) return;
    const failedNumbers = genNumbers.filter((n) => genStatusMap[n]?.status === 'error');
    if (failedNumbers.length === 0) return;

    setItemGenerating(true);
    try {
      const geminiApiKey = getGeminiApiKey()!;
      const usedTopics = extractTopics(generatedReading);
      const result = await regenerateFailedItems(
        geminiApiKey,
        genOptions,
        failedNumbers,
        (unitNumbers, entry) => {
          setGenStatusMap((prev) => {
            const next = { ...prev };
            for (const n of unitNumbers) next[n] = entry;
            return next;
          });
        },
        usedTopics,
      );

      const newListening = [...generatedListening, ...result.listening];
      const newReading = [...generatedReading, ...result.reading];
      setGeneratedListening(newListening);
      setGeneratedReading(newReading);

      const succeeded = new Set([...newListening.map((i) => i.number), ...newReading.map((i) => i.number)]);
      const allSucceeded = genNumbers.every((n) => succeeded.has(n));
      if (allSucceeded) {
        await finalizeGeneratedExam(newListening, newReading, genOptions, genTitle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '문항 재생성 중 오류가 발생했습니다.');
    } finally {
      setItemGenerating(false);
    }
  };

  // HWPX/PDF는 이미 생성돼 있는 examSet(문항 JSON)만 다시 사용해 해당 단계만 재시도한다.
  const handleRetryHwpx = async () => {
    if (!examSet) return;
    setRetryingStage('hwpx');
    setHwpxFailedReason(undefined);
    try {
      const hwpx = await requestHwpx(examSet.listening, examSet.reading, resolveHwpxPdfMode(examSet));
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
      const pdf = await requestPdf(examSet, resolveHwpxPdfMode(examSet));
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

  // 카드뷰(ExamItemCard)의 "AI 음성 생성" 버튼 — 기존 문항별 개별 생성 로직
  // (generateListeningClips)을 그대로 재사용해 클릭한 문항 하나만 생성한다.
  const handleGenerateOneClip = (itemKey: string) => {
    const unit = listeningClipUnits.find((u) => u.itemKey === itemKey);
    if (!unit || !audioSessionId || !ttsApiKey) return;
    void runClipGeneration(audioSessionId, ttsApiKey, [unit]);
  };

  // "실패만 재생성"과 별개인 "전체 재생성" — 이미 완료(done)된 문항까지 포함해 전체를
  // 다시 생성한다(듣기 디렉션 음성 도입처럼, 이미 생성해둔 클립을 최신 구조로 다시
  // 만들어야 할 때 사용). runClipGeneration은 전달된 units를 그대로 순차 생성하므로
  // 별도 백엔드 변경 없이 재사용 가능.
  const handleRegenerateAllClips = () => {
    if (!audioSessionId || !ttsApiKey) return;
    void runClipGeneration(audioSessionId, ttsApiKey, listeningClipUnits);
  };

  // 카드뷰(ExamItemCard)의 "문항 수정" — 짝 문항(16-17/41-42/43-45)이면
  // buildGenerationUnits가 자동으로 그룹 전체를 묶어 함께 재생성한다(공유 지문/대본이
  // 바뀌면 나머지 문항의 근거도 깨질 수 있어서). 실패하면 examSet은 건드리지 않고
  // 에러 메시지만 해당 카드(들)에 남긴다 — 성공했을 때만 배열을 교체하므로 원본이
  // 항상 보존된다.
  const handleSubmitItemEdit = async (itemNumber: number, instruction: string) => {
    if (!examSet) return;
    const geminiApiKey = getGeminiApiKey();
    if (!geminiApiKey) {
      setNotice('API 키를 먼저 입력해주세요.');
      setView('settings');
      return;
    }

    const [unit] = buildGenerationUnits([itemNumber]);
    setEditStatusMap((prev) => {
      const next = { ...prev };
      for (const n of unit.numbers) next[n] = { status: 'loading' as const };
      return next;
    });

    try {
      // genOptions는 이번 세션에서 직접 생성했을 때만 채워진다 — 새로고침 후 캐시에서
      // 복원된 examSet을 수정하는 경우엔 examSet.metadata로 최대한 채운 기본값으로 대체.
      const options: ExamOptions =
        genOptions ?? {
          ...DEFAULT_EXAM_OPTIONS,
          grade: examSet.metadata.grade,
          academyBranch: examSet.metadata.academyBranch,
        };
      const usedTopics =
        unit.kind === 'reading'
          ? extractTopics(examSet.reading.filter((item) => !unit.numbers.includes(item.number)))
          : [];

      const result = await regenerateItemWithEdit(
        geminiApiKey,
        options,
        itemNumber,
        examSet.listening,
        examSet.reading,
        instruction,
        usedTopics,
      );

      setExamSet((prev) => {
        if (!prev) return prev;
        const replaced = new Set(unit.numbers);
        const merged: ExamSet = {
          ...prev,
          listening:
            unit.kind === 'listening'
              ? [...prev.listening.filter((item) => !replaced.has(item.number)), ...result.listening].sort(
                  (a, b) => a.number - b.number,
                )
              : prev.listening,
          reading:
            unit.kind === 'reading'
              ? [...prev.reading.filter((item) => !replaced.has(item.number)), ...result.reading].sort(
                  (a, b) => a.number - b.number,
                )
              : prev.reading,
        };
        saveExamSet(merged);
        return merged;
      });

      setEditStatusMap((prev) => {
        const next = { ...prev };
        for (const n of unit.numbers) delete next[n];
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '문항 수정 중 알 수 없는 오류가 발생했습니다.';
      setEditStatusMap((prev) => {
        const next = { ...prev };
        for (const n of unit.numbers) next[n] = { status: 'error' as const, message };
        return next;
      });
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
            <ExamModeCards activeMode={activeMode} onSelect={handleSelectMode} />

            {activeMode === 'by-type' && (
              <TypeSelectionPanel
                genNumbers={genNumbers}
                genStatusMap={genStatusMap}
                generating={itemGenerating}
                onGenerate={(numbers, options, title) => void handleGenerateItems(numbers, options, title)}
                onRetryFailed={() => void handleRetryFailedItems()}
              />
            )}

            {activeMode === 'full-set' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <ExamOptionsForm
                  initialOptions={DEFAULT_EXAM_OPTIONS}
                  onSubmit={handleSubmitFullSet}
                  disabled={loading}
                />

                {genNumbers.length > 0 && !examSet && (
                  <ItemGenerationStatus
                    numbers={genNumbers}
                    statusMap={genStatusMap}
                    generating={itemGenerating}
                    onRetryFailed={() => void handleRetryFailedItems()}
                  />
                )}
              </div>
            )}

            {/* 결과 화면(HWPX/PDF 진행상황, 생성된 문항, 듣기 음성, 다운로드) — 어느 카드에서
                생성을 시작했든 activeMode와 무관하게 examSet이 있으면 그대로 보여준다("유형별"
                에서 생성했는데 "1세트" 카드로 강제 전환되던 버그 수정). */}
            {(examSet || (pipelineStage && pipelineStage !== 'done') || error) && (
              <div className="max-w-2xl mx-auto space-y-4">
                {pipelineStage && pipelineStage !== 'done' && (
                  <GenerationProgress steps={steps} currentKey={pipelineStage} />
                )}

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
                      <summary className="cursor-pointer text-blue-600">개발자용 JSON 보기</summary>
                      <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap mt-2">
                        {JSON.stringify(examSet, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                {/* 참고 앱("AI 유형" 결과 화면)과 동일한 카드뷰 — "1세트"/"유형별" 어느 경로로
                    생성했든 examSet의 모든 문항을 이 형태로 보여준다. */}
                {examSet &&
                  [...examSet.listening, ...examSet.reading]
                    .sort((a, b) => a.number - b.number)
                    .map((item) => {
                      const itemKey = String(item.number);
                      const clipUnit = listeningClipUnits.find((u) => u.itemKey === itemKey);
                      const editEntry = editStatusMap[item.number];
                      return (
                        <ExamItemCard
                          key={item.number}
                          item={item}
                          clipStatus={clipUnit ? clipStatusMap[itemKey]?.status ?? 'pending' : undefined}
                          clipMessage={clipStatusMap[itemKey]?.message}
                          onGenerateAudio={
                            clipUnit && ttsApiKey ? () => handleGenerateOneClip(itemKey) : undefined
                          }
                          audioBusy={clipGenerating}
                          editStatus={editEntry?.status}
                          editErrorMessage={editEntry?.message}
                          onSubmitEdit={(instruction) => void handleSubmitItemEdit(item.number, instruction)}
                        />
                      );
                    })}

                {examSet && examSet.listening.length > 0 && !ttsApiKey && (
                  <p className="text-sm text-gray-500">
                    TTS API 키가 없어 듣기 MP3 생성을 건너뜁니다. (API 키 설정 화면에서 입력 가능)
                  </p>
                )}

                {examSet && examSet.listening.length > 0 && ttsApiKey && (
                  <ListeningAudioPanel
                    units={listeningClipUnits}
                    statusMap={clipStatusMap}
                    generating={clipGenerating}
                    merging={audioMerging}
                    mergeFailedReason={mergeFailedReason}
                    onRetryFailed={handleRetryFailedClips}
                    onRegenerateAll={handleRegenerateAllClips}
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
