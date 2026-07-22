import type { Choice, ListeningItem, ReadingItem } from '../lib/types';
import { LISTENING_ITEM_TYPES, READING_ITEM_TYPES } from '../lib/examItemTypes';

export type ClipButtonStatus = 'pending' | 'done' | 'error';

interface ExamItemCardProps {
  item: ListeningItem | ReadingItem;
  // 듣기 문항이고 별도 생성 유닛이 있을 때만 전달됨(16-17번 중 대본이 빈 쪽은 없음) —
  // undefined면 "AI 음성 생성" 버튼 자체를 숨긴다.
  clipStatus?: ClipButtonStatus;
  clipMessage?: string;
  onGenerateAudio?: () => void;
  audioBusy: boolean;
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

function CardHeader({ item, typeLabel }: { item: ListeningItem | ReadingItem; typeLabel: string }) {
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
          disabled
          title="문항 수정 기능은 다음 업데이트에서 제공됩니다"
          className="rounded-lg border border-gray-200 text-gray-400 text-xs px-2 py-1 cursor-not-allowed whitespace-nowrap"
        >
          문항 수정
        </button>
      </div>
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
function ExamItemCard({ item, clipStatus, clipMessage, onGenerateAudio, audioBusy }: ExamItemCardProps) {
  const listening = isListeningItem(item);
  const typeLabel = TYPE_LABELS.get(item.number) ?? '';

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-3">
      <CardHeader item={item} typeLabel={typeLabel} />

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
