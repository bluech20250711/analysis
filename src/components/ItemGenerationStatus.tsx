import type { ItemStatusEntry } from '../lib/examGenerationOrchestration';

interface ItemGenerationStatusProps {
  numbers: number[];
  statusMap: Record<number, ItemStatusEntry>;
  generating: boolean;
  onRetryFailed: () => void;
}

const STATUS_ICON: Record<ItemStatusEntry['status'], string> = { pending: '⏳', done: '✅', error: '❌' };

const CHIP_CLASS: Record<ItemStatusEntry['status'], string> = {
  pending: 'border-gray-200 bg-gray-50 text-gray-500',
  done: 'border-green-300 bg-green-50 text-green-700',
  error: 'border-red-300 bg-red-50 text-red-700',
};

// 문항(또는 짝 그룹) 단위 Gemini 생성 진행상황 — 듣기 음성 생성(ListeningAudioPanel)과 동일한
// ⏳/✅/❌ 그리드 + "실패만 재생성" 패턴을 문항 텍스트 생성에도 그대로 적용한다. "모의고사
// 1세트"(45개 고정)와 "모의고사 유형별"(가변 개수) 양쪽에서 공용으로 사용한다.
function ItemGenerationStatus({ numbers, statusMap, generating, onRetryFailed }: ItemGenerationStatusProps) {
  const doneCount = numbers.filter((n) => statusMap[n]?.status === 'done').length;
  const errorNumbers = numbers.filter((n) => statusMap[n]?.status === 'error');

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">문항 생성 진행상황</h2>
      <p className="text-sm text-gray-600">
        {numbers.length}개 중 {doneCount}개 완료
        {errorNumbers.length > 0 && ` (실패 ${errorNumbers.length}개)`}
      </p>
      <div className="flex flex-wrap gap-2">
        {numbers.map((n) => {
          const status = statusMap[n]?.status ?? 'pending';
          const message = statusMap[n]?.message;
          return (
            <span
              key={n}
              title={message ? `${n}번: ${message}` : `${n}번`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${CHIP_CLASS[status]}`}
            >
              {STATUS_ICON[status]} {n}
            </span>
          );
        })}
      </div>
      {errorNumbers.length > 0 && (
        <button
          type="button"
          onClick={onRetryFailed}
          disabled={generating}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {generating ? '재생성 중…' : `실패한 ${errorNumbers.length}개만 재생성`}
        </button>
      )}
    </div>
  );
}

export default ItemGenerationStatus;
