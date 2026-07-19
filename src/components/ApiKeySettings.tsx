import { useState } from 'react';
import {
  getGeminiApiKey,
  getTtsApiKey,
  setGeminiApiKey,
  setTtsApiKey,
} from '../lib/apiKeyStorage';

interface ApiKeySettingsProps {
  onSaved?: () => void;
}

function ApiKeySettings({ onSaved }: ApiKeySettingsProps) {
  const [geminiKey, setGeminiKeyInput] = useState(() => getGeminiApiKey() ?? '');
  const [ttsKey, setTtsKeyInput] = useState(() => getTtsApiKey() ?? '');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setGeminiApiKey(geminiKey.trim());
    setTtsApiKey(ttsKey.trim());
    setSaved(true);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">API 키 설정</h2>
        <p className="text-sm text-gray-500 mt-1">
          입력한 키는 이 브라우저의 localStorage에만 저장되며 서버로 전송되지 않습니다.
          기기를 바꾸거나 브라우저 데이터를 지우면 다시 입력해야 합니다.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="gemini-key" className="block text-sm font-medium text-gray-700 mb-1">
            Gemini API 키
          </label>
          <input
            id="gemini-key"
            type="password"
            autoComplete="off"
            value={geminiKey}
            onChange={(e) => {
              setGeminiKeyInput(e.target.value);
              setSaved(false);
            }}
            placeholder="AIza..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="tts-key" className="block text-sm font-medium text-gray-700 mb-1">
            Google Cloud TTS API 키
          </label>
          <input
            id="tts-key"
            type="password"
            autoComplete="off"
            value={ttsKey}
            onChange={(e) => {
              setTtsKeyInput(e.target.value);
              setSaved(false);
            }}
            placeholder="(Phase 4부터 사용 — 지금은 비워둬도 됩니다)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          저장
        </button>

        {saved && (
          <div className="text-center space-y-2">
            <p className="text-sm text-green-600">저장되었습니다.</p>
            {onSaved && (
              <button
                type="button"
                onClick={onSaved}
                className="text-sm text-blue-600 hover:underline"
              >
                메인 화면으로 이동
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

export default ApiKeySettings;
