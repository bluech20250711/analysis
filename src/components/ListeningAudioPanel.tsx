import type { ListeningClipUnit } from '../lib/audioOrchestration';
import type { ListeningClipsStatusMap } from '../lib/audio/listeningClipsStore';

interface ListeningAudioPanelProps {
  units: ListeningClipUnit[]; // 인트로/아웃트로 포함 — 화면에는 1~17번만 표시
  statusMap: ListeningClipsStatusMap;
  generating: boolean;
  merging: boolean;
  mergeFailedReason?: string;
  onRetryFailed: () => void;
  onMerge: () => void;
}

function iconFor(entry: ListeningClipsStatusMap[string] | undefined): string {
  if (!entry || entry.status === 'pending') return '⏳';
  if (entry.status === 'done') return '✅';
  return '❌';
}

// 설계스펙 v2(5절, 문항별 개별 생성): 17개 문항의 음성 생성 상태를 ⏳/✅/❌ 그리드로 보여주고,
// 실패한 문항만 골라 재시도하거나(성공한 문항은 그대로 유지) 전부 완료됐을 때만 최종 mp3로
// 병합하는 두 버튼을 제공한다. 인트로/아웃트로 안내멘트도 같은 로직으로 생성되지만 화면에는
// 번거로움을 줄이기 위해 표시하지 않고 "전체 완료" 판정에만 포함시킨다.
function ListeningAudioPanel({
  units,
  statusMap,
  generating,
  merging,
  mergeFailedReason,
  onRetryFailed,
  onMerge,
}: ListeningAudioPanelProps) {
  const numberedUnits = units
    .filter((unit) => unit.itemKey !== 'intro' && unit.itemKey !== 'outro')
    .sort((a, b) => Number(a.itemKey) - Number(b.itemKey));

  const hasFailed = units.some((unit) => statusMap[unit.itemKey]?.status === 'error');
  const allDone = units.length > 0 && units.every((unit) => statusMap[unit.itemKey]?.status === 'done');
  const busy = generating || merging;

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">듣기 음성 생성</h2>

      <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
        {numberedUnits.map((unit) => {
          const entry = statusMap[unit.itemKey];
          return (
            <div
              key={unit.itemKey}
              className="flex flex-col items-center justify-center rounded-lg border border-gray-200 py-2 text-sm"
              title={entry?.status === 'error' ? entry.message : undefined}
            >
              <span>{iconFor(entry)}</span>
              <span className="text-xs text-gray-500">{unit.itemKey}번</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasFailed && (
          <button
            type="button"
            onClick={onRetryFailed}
            disabled={busy}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? '재생성 중…' : '실패만 재생성'}
          </button>
        )}
        <button
          type="button"
          onClick={onMerge}
          disabled={!allDone || busy}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {merging ? '병합 중…' : '듣기평가 mp3로 병합'}
        </button>
      </div>

      {mergeFailedReason && <p className="text-sm text-red-600">병합 실패: {mergeFailedReason}</p>}
    </div>
  );
}

export default ListeningAudioPanel;
