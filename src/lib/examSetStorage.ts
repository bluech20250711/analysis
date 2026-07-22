import type { ExamSet } from './types';

// Gemini로 생성한 문항 JSON을 브라우저 localStorage에 보관한다. TTS/HWPX/PDF 등 뒷단계가
// 실패해도 Gemini를 다시 호출하지 않고 이미 생성된 문항으로 그 단계만 재시도할 수 있도록
// 하기 위함(디버깅/재배포 검증 중 API 호출을 불필요하게 반복 소모하는 문제 방지).
const EXAM_SET_STORAGE_KEY = 'csat-gen:last-exam-set';
// 문항별 개별 음성 생성(설계스펙 v2)의 Netlify Blobs 키 네임스페이스. examSet과 함께
// 저장해두어야 새로고침 후에도 "실패만 재생성"이 이전에 이미 성공한 문항의 클립을
// 그대로 가리킬 수 있다(examSet만 저장하고 매번 새 세션 id를 만들면 문항 재사용은
// 되지만 오디오 진행 상황은 매번 초기화되어 버림).
const AUDIO_SESSION_ID_STORAGE_KEY = 'csat-gen:audio-session-id';

export function saveExamSet(examSet: ExamSet): void {
  try {
    localStorage.setItem(EXAM_SET_STORAGE_KEY, JSON.stringify(examSet));
  } catch {
    // localStorage 용량 초과 등은 무시 — 저장 실패해도 현재 세션의 메모리 상태는 그대로 유지됨
  }
}

export function loadExamSet(): ExamSet | null {
  try {
    const raw = localStorage.getItem(EXAM_SET_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ExamSet) : null;
  } catch {
    return null;
  }
}

export function clearExamSet(): void {
  try {
    localStorage.removeItem(EXAM_SET_STORAGE_KEY);
  } catch {
    // 무시
  }
}

export function saveAudioSessionId(audioSessionId: string): void {
  try {
    localStorage.setItem(AUDIO_SESSION_ID_STORAGE_KEY, audioSessionId);
  } catch {
    // 무시
  }
}

export function loadAudioSessionId(): string | null {
  try {
    return localStorage.getItem(AUDIO_SESSION_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}
