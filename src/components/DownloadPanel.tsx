import type { ExamSet } from '../lib/types';

type RetryableStage = 'audio' | 'hwpx' | 'pdf';

interface DownloadPanelProps {
  examSet: ExamSet;
  hwpxBlob?: Blob;
  pdfBlob?: Blob;
  audioBlob?: Blob;
  audioSkippedReason?: string;
  hwpxFailedReason?: string;
  pdfFailedReason?: string;
  ttsApiKeyAvailable?: boolean;
  retryingStage?: RetryableStage | null;
  onRetryAudio?: () => void;
  onRetryHwpx?: () => void;
  onRetryPdf?: () => void;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DownloadPanel({
  examSet,
  hwpxBlob,
  pdfBlob,
  audioBlob,
  audioSkippedReason,
  hwpxFailedReason,
  pdfFailedReason,
  ttsApiKeyAvailable,
  retryingStage,
  onRetryAudio,
  onRetryHwpx,
  onRetryPdf,
}: DownloadPanelProps) {
  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(examSet, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'exam-set.json');
  };

  const anyRetrying = retryingStage != null;
  const retryButtonClass =
    'px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0';

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">다운로드</h2>
      <p className="text-xs text-gray-400">
        문항 데이터는 브라우저에 보관되어 있어, 아래 "다시 생성" 버튼으로 Gemini 재호출 없이 해당
        산출물만 다시 만들 수 있습니다.
      </p>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {hwpxBlob ? (
            <button
              type="button"
              onClick={() => downloadBlob(hwpxBlob, 'exam.hwpx')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              시험지 HWPX 다운로드
            </button>
          ) : (
            <p className="text-sm text-red-600 flex-1">
              {hwpxFailedReason ? `HWPX 생성 실패: ${hwpxFailedReason}` : 'HWPX 미생성'}
            </p>
          )}
          {onRetryHwpx && (
            <button type="button" onClick={onRetryHwpx} disabled={anyRetrying} className={retryButtonClass}>
              {retryingStage === 'hwpx' ? 'HWPX 재생성 중…' : 'HWPX만 다시 생성'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pdfBlob ? (
            <button
              type="button"
              onClick={() => downloadBlob(pdfBlob, 'exam.pdf')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              시험지 PDF 다운로드
            </button>
          ) : (
            <p className="text-sm text-red-600 flex-1">
              {pdfFailedReason ? `PDF 생성 실패: ${pdfFailedReason}` : 'PDF 미생성'}
            </p>
          )}
          {onRetryPdf && (
            <button type="button" onClick={onRetryPdf} disabled={anyRetrying} className={retryButtonClass}>
              {retryingStage === 'pdf' ? 'PDF 재생성 중…' : 'PDF만 다시 생성'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {audioBlob ? (
            <button
              type="button"
              onClick={() => downloadBlob(audioBlob, 'listening.mp3')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              듣기평가 MP3 다운로드
            </button>
          ) : (
            <p className="text-sm text-gray-500 flex-1">
              {audioSkippedReason ?? 'MP3 미생성'}
            </p>
          )}
          {ttsApiKeyAvailable && onRetryAudio && (
            <button type="button" onClick={onRetryAudio} disabled={anyRetrying} className={retryButtonClass}>
              {retryingStage === 'audio' ? '음성 재생성 중…' : '음성만 다시 생성'}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownloadJson}
        className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm"
      >
        문항 데이터 JSON 다운로드
      </button>
    </div>
  );
}

export default DownloadPanel;
