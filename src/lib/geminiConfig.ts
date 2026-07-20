// Gemini 모델 설정 — 이 프로젝트에서 Gemini 모델명을 하드코딩하는 유일한 위치.
// 모델이 종료(deprecate)되거나 더 나은 모델로 교체해야 할 때는 이 값만 고치면 된다.
//
// 2026-07-20: gemini-2.5-pro가 2026-06-17부로 신규 사용자에게 완전히 종료되어
// (호출 시 404 NOT_FOUND) gemini-3.1-pro-preview로 교체함. 문항 JSON 스키마를
// 강제하는 복잡한 구조화 출력이 필요해 flash가 아닌 pro급 모델을 유지한다.
export const GEMINI_MODEL = 'gemini-3.1-pro-preview';
