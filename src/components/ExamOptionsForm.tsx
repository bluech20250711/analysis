import { useState } from 'react';
import type { ExamOptions } from '../lib/types';

interface ExamOptionsFormProps {
  initialOptions: ExamOptions;
  onSubmit: (options: ExamOptions) => void;
  disabled?: boolean;
}

function ExamOptionsForm({ initialOptions, onSubmit, disabled }: ExamOptionsFormProps) {
  const [yearLevel, setYearLevel] = useState(initialOptions.yearLevel);
  const [grade, setGrade] = useState(initialOptions.grade);
  const [academyBranch, setAcademyBranch] = useState(initialOptions.academyBranch);
  const [ebsLinked, setEbsLinked] = useState(initialOptions.ebsLinked);
  const [schoolStyle, setSchoolStyle] = useState(initialOptions.schoolStyle ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      yearLevel: yearLevel.trim(),
      grade: grade.trim(),
      academyBranch: academyBranch.trim(),
      ebsLinked,
      schoolStyle: schoolStyle.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">출제 옵션</h2>

      <div>
        <label htmlFor="year-level" className="block text-sm font-medium text-gray-700 mb-1">
          기준 (연도 / 모의고사 수준)
        </label>
        <input
          id="year-level"
          value={yearLevel}
          onChange={(e) => setYearLevel(e.target.value)}
          placeholder="예: 2027학년도 수능 대비 / 고3 6월 모의평가 수준"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-1">
            학년
          </label>
          <select
            id="grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="중3">중3</option>
            <option value="고1">고1</option>
            <option value="고2">고2</option>
            <option value="고3">고3</option>
          </select>
        </div>
        <div>
          <label htmlFor="academy-branch" className="block text-sm font-medium text-gray-700 mb-1">
            학원 지점
          </label>
          <input
            id="academy-branch"
            value={academyBranch}
            onChange={(e) => setAcademyBranch(e.target.value)}
            placeholder="예: 이언어학원 나루관"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label htmlFor="school-style" className="block text-sm font-medium text-gray-700 mb-1">
          학교 스타일 (선택)
        </label>
        <input
          id="school-style"
          value={schoolStyle}
          onChange={(e) => setSchoolStyle(e.target.value)}
          placeholder="특정 학교 내신 스타일을 참고하려면 입력 (선택)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={ebsLinked}
          onChange={(e) => setEbsLinked(e.target.checked)}
          className="h-4 w-4"
        />
        EBS 연계 (최신 수능특강 영어 지문 변형)
      </label>

      <button
        type="submit"
        disabled={disabled}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {disabled ? '생성 중...' : '모의고사 1세트 생성 시작 (45문항)'}
      </button>
    </form>
  );
}

export default ExamOptionsForm;
