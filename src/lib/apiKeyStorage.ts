// 사용자 API 키를 브라우저 localStorage에만 저장한다 (서버 전송/저장 없음).
// 설계스펙 9절(BYOK) 참고.

const GEMINI_KEY_STORAGE_KEY = 'csat-gen:gemini-api-key';
const TTS_KEY_STORAGE_KEY = 'csat-gen:tts-api-key';

function readKey(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeKey(storageKey: string, value: string): void {
  localStorage.setItem(storageKey, value);
}

function removeKey(storageKey: string): void {
  localStorage.removeItem(storageKey);
}

export function getGeminiApiKey(): string | null {
  return readKey(GEMINI_KEY_STORAGE_KEY);
}

export function setGeminiApiKey(key: string): void {
  writeKey(GEMINI_KEY_STORAGE_KEY, key);
}

export function clearGeminiApiKey(): void {
  removeKey(GEMINI_KEY_STORAGE_KEY);
}

export function getTtsApiKey(): string | null {
  return readKey(TTS_KEY_STORAGE_KEY);
}

export function setTtsApiKey(key: string): void {
  writeKey(TTS_KEY_STORAGE_KEY, key);
}

export function clearTtsApiKey(): void {
  removeKey(TTS_KEY_STORAGE_KEY);
}

export function hasGeminiApiKey(): boolean {
  const key = getGeminiApiKey();
  return !!key && key.trim().length > 0;
}
