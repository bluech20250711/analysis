import { useState } from 'react';
import { LISTENING_ITEM_TYPES, READING_ITEM_TYPES, type ExamItemType } from '../lib/examItemTypes';

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

// "모의고사 유형별" — 원하는 번호(유형)만 체크해 그 문항들만 생성하는 패널(설계스펙 12절
// 신규 기능). 이번 단계는 UI 골격만 구현: "생성 시작"을 누르면 선택된 문항 번호를
// 콘솔에 남긴다 — 실제 Gemini 호출(체크된 문항만 순차 생성)은 다음 단계에서 연결한다.
function TypeSelectionPanel() {
  const [grade, setGrade] = useState(GRADE_OPTIONS[2]);
  const [difficulty, setDifficulty] = useState(DIFFICULTY_OPTIONS[2]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [name, setName] = useState(() => formatDefaultName());

  const toggle = (number: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  };

  const selectOnly = (numbers: number[]) => setSelected(new Set(numbers));
  const selectAll = () => setSelected(new Set([...LISTENING_NUMBERS, ...READING_NUMBERS]));
  const clearAll = () => setSelected(new Set());

  const handleGenerate = () => {
    const sortedNumbers = [...selected].sort((a, b) => a - b);
    console.log('[TypeSelectionPanel] 생성 시작 — 선택된 문항 번호:', sortedNumbers, { grade, difficulty, name });
  };

  const renderGridItem = (item: ExamItemType) => {
    const checked = selected.has(item.number);
    return (
      <label
        key={item.number}
        title={`${item.number} ${item.type}`}
        className={
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ' +
          (checked ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:bg-gray-50')
        }
      >
        <input
          type="checkbox"
          checked={checked}
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
              onChange={(e) => setGrade(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-lg"
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
              onChange={(e) => setDifficulty(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-lg"
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
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          🎧 듣기만 전체
        </button>
        <button
          type="button"
          onClick={() => selectOnly(READING_NUMBERS)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          📄 독해만 전체
        </button>
        <button
          type="button"
          onClick={selectAll}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          전체 선택
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
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
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={selected.size === 0}
          className="px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          ▷ 생성 시작
        </button>
      </div>

      <p className="text-xs text-gray-400">
        문항별로 순차 생성합니다. 실패한 번호는 완료 후 [실패만 재생성]으로 다시 시도할 수 있고,
        완료되면 시험지가 자동으로 열립니다.
      </p>
    </div>
  );
}

export default TypeSelectionPanel;
