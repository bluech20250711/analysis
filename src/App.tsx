import { useState } from 'react';
import ApiKeySettings from './components/ApiKeySettings';
import { hasGeminiApiKey, getGeminiApiKey } from './lib/apiKeyStorage';
import { generateListening } from './lib/gemini';
import type { ListeningItem, ExamOptions } from './lib/types';

type View = 'main' | 'settings';

const TEST_OPTIONS: ExamOptions = {
  yearLevel: '2027학년도 수능 대비 / 고3 6월 모의평가 수준',
  ebsLinked: false,
  grade: '고3',
  academyBranch: '석우관',
};

function App() {
  const [view, setView] = useState<View>(hasGeminiApiKey() ? 'main' : 'settings');
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ListeningItem[] | null>(null);

  const handleGenerateClick = async () => {
    if (!hasGeminiApiKey()) {
      setNotice('API 키를 먼저 입력해주세요.');
      setView('settings');
      return;
    }

    setNotice(null);
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const apiKey = getGeminiApiKey()!;
      const items = await generateListening(apiKey, TEST_OPTIONS);
      setResult(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '문항 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <h1 className="text-lg font-semibold">수능 영어영역 자동 출제 앱</h1>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setView(view === 'settings' ? 'main' : 'settings');
          }}
          className="text-sm text-blue-600 hover:underline"
        >
          {view === 'settings' ? '← 돌아가기' : 'API 키 설정'}
        </button>
      </header>

      <main className="p-6">
        {notice && (
          <div className="max-w-2xl mx-auto mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
            {notice}
          </div>
        )}

        {view === 'settings' ? (
          <ApiKeySettings
            onSaved={() => {
              setNotice(null);
              setView('main');
            }}
          />
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            <p className="text-gray-500">Phase 1: Gemini 문항 생성 모듈 개발 중 (BYOK)</p>

            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '생성 중...' : '듣기 1-17번 테스트 생성'}
            </button>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {result && (
              <div className="bg-white rounded-xl shadow p-4 space-y-3">
                <p className="font-medium">듣기 문항 {result.length}개 생성 완료</p>
                <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
