import type { ExamSet } from '../lib/types';

interface DownloadPanelProps {
  examSet: ExamSet;
  hwpxBlob?: Blob;
  pdfBlob?: Blob;
  audioBlob?: Blob;
  audioSkippedReason?: string;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DownloadPanel({ examSet, hwpxBlob, pdfBlob, audioBlob, audioSkippedReason }: DownloadPanelProps) {
  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(examSet, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'exam-set.json');
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">다운로드</h2>

      <div className="flex flex-wrap gap-2">
        {hwpxBlob && (
          <button
            type="button"
            onClick={() => downloadBlob(hwpxBlob, 'exam.hwpx')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            시험지 HWPX 다운로드
          </button>
        )}
        {pdfBlob && (
          <button
            type="button"
            onClick={() => downloadBlob(pdfBlob, 'exam.pdf')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            시험지 PDF 다운로드
          </button>
        )}
        {audioBlob && (
          <button
            type="button"
            onClick={() => downloadBlob(audioBlob, 'listening.mp3')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            듣기평가 MP3 다운로드
          </button>
        )}
        <button
          type="button"
          onClick={handleDownloadJson}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm"
        >
          문항 데이터 JSON 다운로드
        </button>
      </div>

      {!audioBlob && audioSkippedReason && <p className="text-sm text-gray-500">{audioSkippedReason}</p>}
    </div>
  );
}

export default DownloadPanel;
