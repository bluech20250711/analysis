import { useState } from 'react';
import { LISTENING_ITEM_TYPES, READING_ITEM_TYPES, type ExamItemType } from '../lib/examItemTypes';
import { DEFAULT_EXAM_OPTIONS } from '../lib/defaultExamOptions';
import type { ItemStatusEntry } from '../lib/examGenerationOrchestration';
import type { ExamOptions } from '../lib/types';
import ItemGenerationStatus from './ItemGenerationStatus';

const GRADE_OPTIONS = ['고1', '고2', '고3'];
const DIFFICULTY_OPTIONS = ['고1 학습 수준', '고2 학습 수준', '고3 수능 실전 수준', '고3 최고난도(N제)'];

function formatDefaultName(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `AI유형 ${yy}${mm}${dd}`;
}

const LISTENING_NUMBERS = LISTENING_ITEM_TYPES.map((item) => item.number);
const READING_NUMBERS = READING_ITEM_TYPES.map((item) => item.number);

interface TypeSelectionPanelProps {
  genNumbers: number[];
  genStatusMap: Record<number, ItemStatusEntry>;
  generating: boolean;
  onGenerate: (numbers: number[], options: ExamOptions, title: string) => void;
  onRetryFailed: () => void;
}

// "모의고사 유형별" — 원하는 번호(유형)만 체크해 그 문항들만 생성하는 패널(설계스펙 12절
// 신규 기능). 체크된 번호는 App.tsx의 handleGenerateItems로 전달돼 실제 Gemini 호출로
// 이어진다(짝 문항 16-17/41-42/43-45는 App.tsx가 buildGenerationUnits로 자동 확장).
function TypeSelectionPanel({ genNumbers, genStatusMap, generating, onGenerate, onRetryFailed }: TypeSelectionPanelProps) {
  const [grade, setGrade] = useState(GRADE_OPTIONS[2]);
  const [difficulty, setDifficulty] = useState(DIFFICULTY_OPTIONS[2]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [name, setName] = useState(() => formatDefaultName());

  const toggle = (number: number) => {
    if (generating) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  };

  const selectOnly = (numbers: number[]) => {
    if (generating) return;
    setSelected(new Set(numbers));
  };
  const selectAll = () => {
    if (generating) return;
    setSelected(new Set([...LISTENING_NUMBERS, ...READING_NUMBERS]));
  };
  const clearAll = () => {
    if (generating) return;
    setSelected(new Set());
  };

  const handleGenerateClick = () => {
    const sortedNumbers = [...selected].sort((a, b) => a - b);
    const options: ExamOptions = {
      ...DEFAULT_EXAM_OPTIONS,
      yearLevel: difficulty,
      grade,
    };
    onGenerate(sortedNumbers, options, name.trim() || formatDefaultName());
  };

  const renderGridItem = (item: ExamItemType) => {
    const checked = selected.has(item.number);
    return (
      <label
        key={item.number}
        title={`${item.number} ${item.type}`}
        className={
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ' +
          (generating ? 'opacity-60 cursor-not-allowed ' : 'cursor-pointer ') +
          (checked ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:bg-gray-50')
        }
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={generating}
          onChange={() => toggle(item.number)}
          className="h-4 w-4 shrink-0 accent-red-700"
        />
        <span className="truncate">
          <span className="font-medium">{item.number}</span> {item.type}
        </span>
      </label>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-800">유형별 생성 — 만들 번호를 체크하세요</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            학년
            <select
              value={grade}
              disabled={generating}
              onChange={(e) => setGrade(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-lg disabled:opacity-60"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            난이도
            <select
              value={difficulty}
              disabled={generating}
              onChange={(e) => setDifficulty(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-lg disabled:opacity-60"
            >
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <span>
            문제수 <span className="font-semibold">{selected.size}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectOnly(LISTENING_NUMBERS)}
          disabled={generating}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          🎧 듣기만 전체
        </button>
        <button
          type="button"
          onClick={() => selectOnly(READING_NUMBERS)}
          disabled={generating}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          📄 독해만 전체
        </button>
        <button
          type="button"
          onClick={selectAll}
          disabled={generating}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          전체 선택
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={generating}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          모두 해제
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">듣기 (1~17)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {LISTENING_ITEM_TYPES.map(renderGridItem)}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">독해 (18~45)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {READING_ITEM_TYPES.map(renderGridItem)}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="type-set-name" className="block text-sm font-medium text-gray-700 mb-1">
            이름
          </label>
          <input
            id="type-set-name"
            value={name}
            disabled={generating}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          onClick={handleGenerateClick}
          disabled={selected.size === 0 || generating}
          className="px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {generating ? '생성 중…' : '▷ 생성 시작'}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        문항별로 순차 생성합니다. 짝 문항(16-17, 41-42, 43-45)은 하나만 체크해도 그룹 전체가 자동으로
        함께 생성됩니다. 실패한 번호는 [실패만 재생성]으로 다시 시도할 수 있고, 완료되면 시험지가
        자동으로 열립니다.
      </p>

      {genNumbers.length > 0 && (
        <ItemGenerationStatus
          numbers={genNumbers}
          statusMap={genStatusMap}
          generating={generating}
          onRetryFailed={onRetryFailed}
        />
      )}
    </div>
  );
}

export default TypeSelectionPanel;
