import type { ExamSet } from './types';

// Gemini로 생성한 문항 JSON을 브라우저 localStorage에 보관한다. TTS/HWPX/PDF 등 뒷단계가
// 실패해도 Gemini를 다시 호출하지 않고 이미 생성된 문항으로 그 단계만 재시도할 수 있도록
// 하기 위함(디버깅/재배포 검증 중 API 호출을 불필요하게 반복 소모하는 문제 방지).
const EXAM_SET_STORAGE_KEY = 'csat-gen:last-exam-set';

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
