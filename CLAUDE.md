# CSAT English Generator — 프로젝트 메모리

> 향후 세션에서 이 프로젝트를 이어갈 때 먼저 읽어야 할 문서. 원본 설계 문서는
> `docs/수능영어_자동출제앱_설계스펙.md`, `docs/수능영어_모의고사_출제_프롬프트.md` 전체 참고.

## 프로젝트 개요

한국 대학수학능력시험 영어영역 모의고사 1세트(45문항)를 자동 생성하는 웹앱.

**산출물 3가지**
1. 듣기 1~17번 — 문항(대본) 생성 + 화자별 TTS 음성 + 하나의 듣기평가 MP3로 병합
2. 독해 18~45번 — 문항 유형별 지문/선택지/정답/해설 생성
3. 최종 출력 — 이언어학원 시험지 양식(`고등부.hwpx` 기준)에 맞춘 **HWPX** + **PDF** + 듣기 **MP3**

**핵심 제약**
- 실제 기출 표절 금지. 유형·구조·난이도만 모사한 창작 문항이어야 함
- 문항별 출제 기준(유형, 난이도, 지문 길이 등)은 `docs/수능영어_모의고사_출제_프롬프트.md`의 Part1(듣기 1-17)/Part2(독해 18-45) 표가 기준 — Gemini 시스템 프롬프트의 핵심 소스
- 최종 산출물은 이언어학원 실제 시험지와 동일한 레이아웃/표지/문항 번호 스타일이어야 함

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프론트엔드 | React + Vite + TypeScript + Tailwind |
| 문항 생성 AI | Gemini API (`gemini-2.5-pro` 또는 flash 계열) |
| TTS | Google Cloud Text-to-Speech (Chirp3-HD / Neural2) |
| 서버리스 백엔드 | Netlify Functions (Node.js) — API 키 보호, HWPX/PDF/오디오 병합 |
| HWPX 생성 | Node.js + `jszip` (XML 템플릿 주입), mimetype은 반드시 STORED |
| PDF 생성 | `@react-pdf/renderer` 또는 Puppeteer 서버리스 함수 |
| 오디오 병합 | `ffmpeg` (`ffmpeg-static`) — Background Function 필요 (동기 함수 10초 제한) |
| 배포 | Netlify — 순수 SPA + Functions (SSR 금지, 과거 `dist/server.cjs` 이슈 재발 방지) |

## 데이터 모델 (`src/lib/types.ts`)

`ExamSet { metadata, listening: ListeningItem[17], reading: ReadingItem[28] }`
- `ListeningItem`: number, type, speakers(M/W/Narrator), script(화자별 대사 분리), choices, answer, explanation, imageRef?, pairGroupId?
- `ReadingItem`: number, type, passage, chartData?, choices(또는 40번 pairChoices), answer, explanation, keyVocab?, pairGroupId?

전체 필드 정의는 설계스펙 문서 3절 참고.

## 전체 데이터 흐름

옵션 선택 → Gemini(듣기 1-17) → Gemini(독해 18-34) → Gemini(독해 35-45, 장문 포함)
→ 듣기 대본 화자별 TTS → ffmpeg 병합(안내멘트/신호음/정적구간) → 최종 MP3
→ 문항 JSON을 HWPX 템플릿에 주입 + PDF 렌더러에 주입 → 시험지.hwpx / 시험지.pdf / 듣기평가.mp3 다운로드

## 개발 로드맵 (Phase)

| Phase | 내용 | 상태 |
|---|---|---|
| 1 | Gemini 문항 생성 모듈 (JSON 스키마 강제, 콘솔 출력 확인) | 진행 중 |
| 2 | HWPX 템플릿 조각 추출 + 텍스트 치환 PoC (문항 1개) | 예정 |
| 3 | HWPX 전체 문항 반복 삽입 + 이미지 삽입 (45문항) | 예정 |
| 4 | Google Cloud TTS 개별 클립 생성 | 예정 |
| 5 | ffmpeg 병합 (신호음/정적구간 포함) | 예정 |
| 6 | PDF 렌더러 구축 | 예정 |
| 7 | 프론트엔드 UI 통합 + 진행상태 표시 | 예정 |
| 8 | Netlify 배포 + Background Function 검증 | 예정 |
| 9 | 정답지 별도 출력, 학교스타일 프리셋 등 확장 | 예정 |

## 환경변수

```
GEMINI_API_KEY=                    # Phase 1부터 필요
GOOGLE_CLOUD_TTS_API_KEY=          # Phase 4부터 필요
GOOGLE_CLOUD_PROJECT_ID=           # Phase 4부터 필요
```

## 폴더 구조 (목표)

```
src/
├── components/        # ExamOptionsForm, GenerationProgress, DownloadPanel
├── lib/
│   ├── gemini.ts       # Gemini 호출 + JSON 파싱/검증
│   ├── prompts/        # listeningPrompt.ts, readingPrompt.ts
│   └── types.ts        # ExamSet 등 타입 정의
├── App.tsx / main.tsx
netlify/functions/      # generate-questions, generate-audio, merge-audio-background, export-hwpx, export-pdf
templates/              # hwpx-template(고등부.hwpx 압축 해제본), pdf-template
docs/                   # 원본 설계 문서 2건 보관
```

## 배포 시 유의사항

- SSR 불필요 — 순수 SPA + Netlify Functions 구조 유지
- ffmpeg 바이너리는 서버리스 함수 배포 용량 제한(보통 50MB) 고려, 초과 시 별도 서비스 분리 검토
- HWPX 출력 파일명은 ASCII만 사용(한글 파일명 다운로드 시 깨짐 이력 있음), 표시명만 한글
