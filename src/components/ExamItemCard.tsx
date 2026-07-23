import { useEffect, useRef, useState } from 'react';
import type { Choice, ListeningItem, ReadingItem } from '../lib/types';
import { LISTENING_ITEM_TYPES, READING_ITEM_TYPES } from '../lib/examItemTypes';

export type ClipButtonStatus = 'pending' | 'done' | 'error';
export type EditButtonStatus = 'loading' | 'error';

interface ExamItemCardProps {
  item: ListeningItem | ReadingItem;
  // 듣기 문항이고 별도 생성 유닛이 있을 때만 전달됨(16-17번 중 대본이 빈 쪽은 없음) —
  // undefined면 "AI 음성 생성" 버튼 자체를 숨긴다.
  clipStatus?: ClipButtonStatus;
  clipMessage?: string;
  onGenerateAudio?: () => void;
  audioBusy: boolean;
  // "문항 수정" — undefined면 loading/error 상태가 없다는 뜻(대기 중). 짝 문항
  // (16-17/41-42/43-45)은 그룹 전체가 함께 재생성되므로, 같은 그룹의 다른 카드도
  // 동시에 'loading'이 될 수 있다(App.tsx가 유닛 단위로 상태를 반영).
  editStatus?: EditButtonStatus;
  editErrorMessage?: string;
  onSubmitEdit?: (instruction: string) => void;
}

const CIRCLED = ['①', '②', '③', '④', '⑤'] as const;

function circledNumber(n: number): string {
  return CIRCLED[n - 1] ?? `${n}.`;
}

function isListeningItem(item: ListeningItem | ReadingItem): item is ListeningItem {
  return 'script' in item;
}

const TYPE_LABELS = new Map(
  [...LISTENING_ITEM_TYPES, ...READING_ITEM_TYPES].map((t) => [t.number, t.type] as const),
);

function ChoiceInterpretationLine({ choice }: { choice: Choice }) {
  return (
    <p className="text-sm text-gray-700">
      {circledNumber(choice.number)} {choice.text}
      {choice.interpretation ? (
        <span className="text-gray-500"> ({choice.interpretation})</span>
      ) : (
        <span className="text-gray-400"> (선택지해석 없음 — 재생성 필요)</span>
      )}
    </p>
  );
}

function CardHeader({
  item,
  typeLabel,
  editDisabled,
  onToggleEdit,
}: {
  item: ListeningItem | ReadingItem;
  typeLabel: string;
  editDisabled: boolean;
  onToggleEdit?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="font-medium text-gray-800">
        <span className="font-bold">{item.number}.</span> {item.instruction}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {typeLabel && (
          <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs px-2 py-1 whitespace-nowrap">
            {typeLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleEdit}
          disabled={!onToggleEdit || editDisabled}
          title={onToggleEdit ? undefined : '문항 수정 기능을 사용할 수 없습니다'}
          className="rounded-lg border border-gray-300 text-gray-600 text-xs px-2 py-1 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          문항 수정
        </button>
      </div>
    </div>
  );
}

function EditPanel({
  instruction,
  onChangeInstruction,
  onSubmit,
  onCancel,
  status,
  errorMessage,
}: {
  instruction: string;
  onChangeInstruction: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  status?: EditButtonStatus;
  errorMessage?: string;
}) {
  const loading = status === 'loading';
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
      {status === 'error' && errorMessage && (
        <p className="text-sm text-red-600">재생성 실패: {errorMessage} (기존 문항은 그대로 유지됩니다)</p>
      )}
      <textarea
        value={instruction}
        onChange={(e) => onChangeInstruction(e.target.value)}
        disabled={loading}
        placeholder="예: 선택지를 더 헷갈리게 만들어줘 / 지문을 여행 소재로 바꿔줘"
        rows={2}
        className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 disabled:opacity-60"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || instruction.trim().length === 0}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '재생성 중…' : '재생성'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          취소
        </button>
      </div>
      {loading && <p className="text-xs text-gray-400">짝 문항(16-17/41-42/43-45)이면 함께 재생성됩니다.</p>}
    </div>
  );
}

function AudioButton({
  status,
  message,
  busy,
  onGenerate,
}: {
  status: ClipButtonStatus;
  message?: string;
  busy: boolean;
  onGenerate: () => void;
}) {
  const icon = status === 'done' ? '✅' : status === 'error' ? '❌' : '';
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={busy}
      title={status === 'error' ? message : undefined}
      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white text-sm px-3 py-1.5 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      ▷ AI 음성 생성 {icon}
    </button>
  );
}

function ChoicesList({ item }: { item: ListeningItem | ReadingItem }) {
  if (Array.isArray(item.choices)) {
    return (
      <div className="space-y-1">
        {[...item.choices]
          .sort((a, b) => a.number - b.number)
          .map((c) => (
            <p key={c.number} className="text-sm text-gray-700">
              {circledNumber(c.number)} {c.text}
            </p>
          ))}
      </div>
    );
  }

  // 40번(요약문 완성) — (A)/(B) 조합 선택지
  const [groupA, groupB] = item.choices.pairChoices;
  return (
    <div className="space-y-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const a = groupA.find((c) => c.number === n);
        const b = groupB.find((c) => c.number === n);
        if (!a || !b) return null;
        return (
          <p key={n} className="text-sm text-gray-700">
            {circledNumber(n)} (A) {a.text} … (B) {b.text}
          </p>
        );
      })}
    </div>
  );
}

function ChoiceInterpretations({ item }: { item: ListeningItem | ReadingItem }) {
  if (!Array.isArray(item.choices)) return null; // 40번은 조합형이라 선택지별 해석 생략(해설로 대체)
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-600">■ 선택지해석:</p>
      {[...item.choices]
        .sort((a, b) => a.number - b.number)
        .map((c) => (
          <ChoiceInterpretationLine key={c.number} choice={c} />
        ))}
    </div>
  );
}

// 참고 앱("AI 유형" 결과 화면)과 동일한 레이아웃의 문항 카드 — 기존 ListeningItem/
// ReadingItem 데이터를 그대로 렌더링한다(별도 데이터 추가 없이 가능). 정답/해설/해석/
// 선택지해석을 전부 본문에 노출하는 "출제 검수용" 카드라, 정답을 각주/별도 섹션에
// 숨기는 기존 시험지 HWPX/PDF(exam.hwpx/exam.pdf)와는 의도적으로 다르다.
function ExamItemCard({
  item,
  clipStatus,
  clipMessage,
  onGenerateAudio,
  audioBusy,
  editStatus,
  editErrorMessage,
  onSubmitEdit,
}: ExamItemCardProps) {
  const listening = isListeningItem(item);
  const typeLabel = TYPE_LABELS.get(item.number) ?? '';

  const [editOpen, setEditOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const prevEditStatus = useRef(editStatus);

  useEffect(() => {
    // 'loading'이었다가 상태가 사라지면(=성공, App.tsx가 완료 후 상태를 지움) 편집 상자를
    // 자동으로 닫는다. 에러로 끝나면 메시지를 보고 다시 시도할 수 있게 열어둔 채로 둔다.
    if (prevEditStatus.current === 'loading' && editStatus === undefined) {
      setEditOpen(false);
      setInstruction('');
    }
    prevEditStatus.current = editStatus;
  }, [editStatus]);

  const handleSubmit = () => {
    if (!onSubmitEdit || instruction.trim().length === 0) return;
    onSubmitEdit(instruction.trim());
  };

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-3">
      <CardHeader
        item={item}
        typeLabel={typeLabel}
        editDisabled={editStatus === 'loading'}
        onToggleEdit={onSubmitEdit ? () => setEditOpen((v) => !v) : undefined}
      />

      {editOpen && onSubmitEdit && (
        <EditPanel
          instruction={instruction}
          onChangeInstruction={setInstruction}
          onSubmit={handleSubmit}
          onCancel={() => setEditOpen(false)}
          status={editStatus}
          errorMessage={editErrorMessage}
        />
      )}

      {listening && clipStatus && onGenerateAudio && (
        <AudioButton status={clipStatus} message={clipMessage} busy={audioBusy} onGenerate={onGenerateAudio} />
      )}

      {listening ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
          <p className="text-xs font-semibold text-gray-500 tracking-wide">LISTENING SCRIPT</p>
          {item.script.length > 0 ? (
            item.script.map((line, i) => (
              <p key={i} className="text-sm text-gray-800">
                {line.speaker}: {line.line}
              </p>
            ))
          ) : (
            <p className="text-sm text-gray-400">(공유 지문 — 짝 문항의 대본과 동일)</p>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
          <p className="text-sm text-gray-800 whitespace-pre-line">{item.passage}</p>
          {item.imageRef && <p className="text-sm text-gray-400 italic">[이미지 자리표시 — {item.imageRef}]</p>}
        </div>
      )}

      <ChoicesList item={item} />

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
        {listening ? (
          item.scriptKo.length > 0 && (
            <div className="space-y-0.5">
              {item.scriptKo.map((line, i) => (
                <p key={i} className="text-sm text-gray-700">
                  {item.script[i]?.speaker}: {line}
                </p>
              ))}
            </div>
          )
        ) : (
          <p className="text-sm text-gray-700">{item.passageKo}</p>
        )}

        <p className="text-sm font-semibold text-blue-700">
          정답: <span className="rounded-full bg-blue-600 text-white px-2 py-0.5 text-xs">{item.answer}</span>
        </p>
        <p className="text-sm text-gray-700">■ 해설: {item.explanation}</p>
        <ChoiceInterpretations item={item} />
      </div>
    </div>
  );
}

export default ExamItemCard;
