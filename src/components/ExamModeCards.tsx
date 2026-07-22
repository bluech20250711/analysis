export type ExamMode = 'full-set' | 'by-type';

interface ExamModeCardsProps {
  activeMode: ExamMode | null;
  onSelect: (mode: ExamMode) => void;
}

// 메인 화면 상단 3분기 카드(설계스펙 12절 신규 기능 — 모의고사 1세트/유형별/미니수능).
// "미니수능"은 이번 단계에서는 카드만 두고 버튼은 비활성 처리(다음 단계에서 구현 예정).
function ExamModeCards({ activeMode, onSelect }: ExamModeCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div
        className={
          'bg-white rounded-xl shadow p-5 flex flex-col gap-3 border-2 transition-colors ' +
          (activeMode === 'full-set' ? 'border-blue-500' : 'border-transparent')
        }
      >
        <h3 className="font-semibold text-gray-800">📄 모의고사 1세트</h3>
        <p className="text-sm text-gray-500 flex-1">
          실제 수능과 동일한 1~45 전체 구성(듣기 17 + 독해 28). 듣기는 문제+대본까지 생성(음성
          파일은 추가작업), 4·25번 그림은 자리만 만들어 두고 나중에 붙입니다.
        </p>
        <button
          type="button"
          onClick={() => onSelect('full-set')}
          className="w-full px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          1세트 생성
        </button>
      </div>

      <div
        className={
          'bg-white rounded-xl shadow p-5 flex flex-col gap-3 border-2 transition-colors ' +
          (activeMode === 'by-type' ? 'border-red-700' : 'border-transparent')
        }
      >
        <h3 className="font-semibold text-gray-800">📚 모의고사 유형별</h3>
        <p className="text-sm text-gray-500 flex-1">
          원하는 번호(유형)만 골라 그 문항들만 생성합니다.
          <br />
          예: 빈칸(31~34)만 10문항, 순서·삽입만 등.
        </p>
        <button
          type="button"
          onClick={() => onSelect('by-type')}
          className="w-full px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors text-sm font-medium"
        >
          유형 골라 생성
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-3 border-2 border-transparent opacity-60">
        <h3 className="font-semibold text-gray-800">✅ 미니수능</h3>
        <p className="text-sm text-gray-500 flex-1">
          축소판 수능(빠른 진단용).
          <br />
          주제, 제목, 함축의미, 빈칸(2), 순서, 삽입, 요약 총 8문항. 다음 업데이트에서 제공됩니다.
        </p>
        <button
          type="button"
          disabled
          title="다음 단계에서 구현 예정입니다"
          className="w-full px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed"
        >
          미니수능 생성
        </button>
      </div>
    </div>
  );
}

export default ExamModeCards;
