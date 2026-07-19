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
| 서버리스 백엔드 | Netlify Functions (Node.js) — HWPX/PDF/오디오 병합 (API 키는 보관하지 않음, BYOK 참고) |
| HWPX 생성 | Node.js + `jszip` (XML 템플릿 주입), mimetype은 반드시 STORED |
| PDF 생성 | `@react-pdf/renderer` 또는 Puppeteer 서버리스 함수 |
| 오디오 병합 | `ffmpeg` (`ffmpeg-static`) — Background Function 필요 (동기 함수 10초 제한) |
| 배포 | Netlify — 순수 SPA + Functions (SSR 금지, 과거 `dist/server.cjs` 이슈 재발 방지) |

## 데이터 모델 (`src/lib/types.ts`)

`ExamSet { metadata, listening: ListeningItem[17], reading: ReadingItem[28] }`
- `ListeningItem`: number, type(유형명), instruction(시험지 지시문 전체 문장), speakers(M/W/Narrator), script(화자별 대사 분리), scriptKo(script와 1:1 대응하는 한국어 해석), choices, answer, explanation, imageRef?, pairGroupId?
- `ReadingItem`: number, type, passage, chartData?, choices(또는 40번 pairChoices), answer, explanation, keyVocab?, pairGroupId?
  - ⚠️ `ReadingItem`에는 `ListeningItem.instruction`에 대응하는 "지시문 전체 문장" 필드가 아직 없음 — 독해 섹션 HWPX 작업 시작 전에 필요 여부 재검토

전체 필드 정의는 설계스펙 문서 3절 참고.

## API 키 관리 방식 — BYOK (설계스펙 9절)

- 로그인 없는 멀티유저 도구이므로 서버(.env)에 공용 키를 두지 않고, **각 사용자가 자신의 Gemini/TTS 키를 앱 화면에서 직접 입력**
- 입력된 키는 브라우저 `localStorage`에만 저장 (서버 전송/저장 없음) — `src/lib/apiKeyStorage.ts`
- Gemini 호출은 **브라우저에서 사용자 키로 직접** 수행 (`src/lib/gemini.ts`가 `apiKey`를 인자로 받음) — 서버 프록시 불필요
- TTS처럼 서버 리소스(ffmpeg 등)가 필요한 작업만 사용자의 TTS 키를 요청에 실어 그 호출 시점에만 일회성 사용(저장 안 함)
- 키 입력 필드는 `type="password"` 마스킹, 콘솔/에러 로그에 키 값 노출 금지, 생성된 지문 등은 `dangerouslySetInnerHTML` 사용 금지(XSS 방지)
- 키가 없을 때 문항 생성 시도 시 안내 메시지와 함께 설정 화면(`ApiKeySettings`)으로 유도

## 전체 데이터 흐름

옵션 선택 → Gemini(듣기 1-17, 브라우저에서 사용자 키로 직접 호출) → Gemini(독해 18-34) → Gemini(독해 35-45, 장문 포함)
→ 듣기 대본 화자별 TTS → ffmpeg 병합(안내멘트/신호음/정적구간) → 최종 MP3
→ 문항 JSON을 HWPX 템플릿에 주입 + PDF 렌더러에 주입 → 시험지.hwpx / 시험지.pdf / 듣기평가.mp3 다운로드

## 개발 로드맵 (Phase)

| Phase | 내용 | 상태 |
|---|---|---|
| 1 | Gemini 문항 생성 모듈 (JSON 스키마 강제) + BYOK API 키 입력 UI | 완료 |
| 2 | HWPX 템플릿 조각 추출 + 텍스트 치환 PoC (문항 1개) | 완료 |
| 3 | HWPX 전체 문항 반복 삽입 + 이미지 삽입 (45문항) | **듣기 1-17번만 완료** — 독해 18-45번은 블로킹(아래 참고) |
| 4 | Google Cloud TTS 개별 클립 생성 | 예정 |
| 5 | ffmpeg 병합 (신호음/정적구간 포함) | 예정 |
| 6 | PDF 렌더러 구축 | 예정 |
| 7 | 프론트엔드 UI 통합 + 진행상태 표시 | 예정 |
| 8 | Netlify 배포 + Background Function 검증 | 예정 |
| 9 | 정답지 별도 출력, 학교스타일 프리셋 등 확장 | 예정 |

## 환경변수

앱 자체는 서버 환경변수로 API 키를 보관하지 않는다(BYOK). 아래는 개발용 Node CLI 테스트 스크립트(`scripts/test-gemini.ts`) 전용:

```
GEMINI_API_KEY=                    # scripts/test-gemini.ts 전용 (앱 런타임과 무관)
```

## HWPX 템플릿 (Phase 2·3 결과, 설계스펙 6절)

- 실제 이언어학원 템플릿 `고등부.hwpx`를 압축 해제해 `templates/hwpx-template/`에 원본 그대로 보관 (mimetype, Contents/*, BinData/*, Preview/*, META-INF/*, settings.xml)
- `Contents/section0.xml`이 실제 문항 본문. **듣기 문항의 영어 대본/한국어 해석/정답/해설은 문제 번호 텍스트 뒤에 각주(`hp:endNote`)로 숨겨져 있는 구조** — 화면에는 문제 지시문만 보이고, 각주를 펼치면 대본·해석·정답·해설이 나옴
- `ListeningItem.scriptKo: string[]`, `ListeningItem.instruction: string` — 각각 한국어 해석, 시험지 지시문 전체 문장. Gemini 프롬프트(`listeningPrompt.ts`)에도 생성 지시 반영 완료

### ⚠️ Phase 3 진행 중 발견한 중요 블로커: 독해(18-45) 템플릿 없음

업로드된 `고등부.hwpx`에는 **듣기 1-17번만 있고 독해 18-45번 구간이 아예 없음** (`section0.xml`을 전수 분석해 확인 — 총 top-level 문단 167개가 모두 표지+듣기17문항+"정답" 라벨로 끝남). 독해 섹션의 2단 편집/지문/도표/장문 레이아웃을 그대로 재현하려면 **독해 구간이 포함된 실제 템플릿 파일이 별도로 필요**하다. 받기 전까지 독해 HWPX 조립은 진행 불가.

### Phase 3 완료 범위: 듣기 1-17번 전체 조립

- `templates/hwpx-template/fragments/`:
  - `listening-line.template.xml` — 대본 한 줄(영/한 공용) 조각. 원본의 복잡한 캐시된 `lineseg` 배열 대신 선택지 문단과 동일한 단순 1-lineseg 스타일 사용(한글이 열 때 재계산하는 것으로 확인됨, Phase 2 PoC로 검증됨)
  - `listening-item.template.xml` — 1~15번 공용(단일 문항, `endNote` 1개). `%%SCRIPT_LINES_EN%%`/`%%SCRIPT_LINES_KO%%`는 위 line 템플릿을 대사 개수만큼 이어붙여 채움
  - `listening-1617-pair.template.xml` — 16-17번 전용(공통 지문 1개 + 문항 2개). 대본은 16번 데이터만 사용
- `src/lib/hwpx/` (Node 전용, `tsconfig.app.json`에서 제외돼 브라우저 번들에는 포함 안 됨):
  - `paths.ts`, `textUtils.ts` — 경로 상수, XML 이스케이프/원문자 변환
  - `listeningFragment.ts` — Phase 2 PoC(1번 문항 단일 치환)용, 유지
  - `listeningSection.ts` — **Phase 3 핵심**. `buildListeningSectionXml(listening: ListeningItem[])`이 17문항 전체를 조립
  - `buildHwpx.ts` — `buildListeningPoCHwpx`(Phase 2, 문항 1개) + `buildListeningExamHwpx`(Phase 3, 듣기 섹션 전체 교체, `jszip` 재압축·mimetype STORE 유지)
- `scripts/hwpx-poc.ts` (`npm run hwpx:poc -- <경로>`, 문항 1개), `scripts/hwpx-listening-poc.ts` (`npm run hwpx:listening-poc -- <경로>`, 17문항 전체) — 둘 다 원본과 뚜렷이 구분되는 테스트 데이터로 검증됨(mimetype STORED, XML 유효성, 신규/원본 내용 대조, 표지·문서 끝부분 보존 확인)

### 알려진 단순화(추후 보강 필요)

- **4번(그림 불일치)**: 원본은 그림 위에 ①~⑤ 위치 라벨이 찍힌 이미지 문제. 지금은 표준 텍스트 5지선다로 대체(`imageRef`는 정보용 문자열일 뿐 실제 이미지 삽입 없음) — 실제 그림 생성/삽입 파이프라인 필요
- **10번(표 문제)**: 원본은 비교표(호텔 등) 삽입. 지금은 표준 텍스트 5지선다로 대체 — 구조화된 표 데이터 필드와 표 렌더링 로직 필요
- **11-17번 "▪선택지해석"(영어 선택지의 한국어 번역) 블록**: 원본엔 있지만 `Choice` 타입에 선택지 번역 필드가 없어 생성물에서는 생략됨

## 폴더 구조 (목표)

```
src/
├── components/        # ApiKeySettings, ExamOptionsForm, GenerationProgress, DownloadPanel
├── lib/
│   ├── apiKeyStorage.ts  # localStorage 기반 Gemini/TTS 키 read/write
│   ├── gemini.ts       # Gemini 호출(사용자 apiKey 인자) + JSON 파싱/검증
│   ├── prompts/        # listeningPrompt.ts, readingPrompt.ts
│   ├── types.ts        # ExamSet 등 타입 정의
│   └── hwpx/           # (Node 전용, 브라우저 번들 제외) HWPX 조립 — paths/textUtils/listeningFragment/listeningSection/buildHwpx
├── App.tsx / main.tsx
scripts/                # test-gemini.ts, hwpx-poc.ts, hwpx-listening-poc.ts (개발용 Node CLI 테스트)
netlify/functions/      # generate-audio, merge-audio-background, export-hwpx, export-pdf (TTS 키는 요청 시점 일회성 전달)
templates/
├── hwpx-template/      # 고등부.hwpx 압축 해제본 원본 + fragments/(파라미터화된 문항 조각 템플릿)
└── pdf-template/       # 예정 (Phase 6)
docs/                   # 원본 설계 문서 2건 보관
```

## 배포 시 유의사항

- SSR 불필요 — 순수 SPA + Netlify Functions 구조 유지
- ffmpeg 바이너리는 서버리스 함수 배포 용량 제한(보통 50MB) 고려, 초과 시 별도 서비스 분리 검토
- HWPX 출력 파일명은 ASCII만 사용(한글 파일명 다운로드 시 깨짐 이력 있음), 표시명만 한글
