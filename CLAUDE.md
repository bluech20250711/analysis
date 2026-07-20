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

## 작업 완료 기준 (중요) — "작업 완료 = main 병합까지"

- 어떤 Phase/작업이든 **커밋·푸시만으로 끝난 것이 아니다.** 기능 브랜치에 커밋 → PR 생성 → **main으로 병합 완료**까지가 하나의 작업 단위다.
- PR을 만들었어도 병합 전까지는 다음 Phase로 넘어가지 않는다. (과거 세션이 PR #1 병합 이후에도 별도 브랜치에서 Phase 2~4를 계속 진행하고 main에는 반영하지 않아, 이후 세션이 main만 보고 그 작업 내역을 전혀 모른 채 처음부터 다시 만든 사고가 있었음 — 이 규칙은 그 재발 방지용)
- 세션을 시작하면 먼저 `git log --oneline --all`, `git branch -a`, `git ls-remote origin`으로 **병합되지 않은 다른 작업 브랜치가 없는지** 확인한다. main이 최신이라고 가정하지 말 것.
- 병합 후에는 다 쓴 기능 브랜치를 정리(삭제)해 다음 세션이 혼동하지 않게 한다.

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프론트엔드 | React + Vite + TypeScript + Tailwind |
| 문항 생성 AI | Gemini API — 모델명은 `src/lib/geminiConfig.ts`의 `GEMINI_MODEL` 한 곳에서만 관리(현재 `gemini-3.1-pro-preview`, 2026-07-20 `gemini-2.5-pro` 종료로 교체) |
| TTS | Google Cloud Text-to-Speech (Chirp3-HD / Neural2) |
| 서버리스 백엔드 | Netlify Functions (Node.js) — HWPX/PDF/오디오 병합 (API 키는 보관하지 않음, BYOK 참고) |
| HWPX 생성 | Node.js + `jszip` (XML 템플릿 주입), mimetype은 반드시 STORED |
| PDF 생성 | `@react-pdf/renderer` 또는 Puppeteer 서버리스 함수 |
| 오디오 병합 | `ffmpeg` (`ffmpeg-static`) — Background Function 필요 (동기 함수 10초 제한) |
| 배포 | Netlify — 순수 SPA + Functions (SSR 금지, 과거 `dist/server.cjs` 이슈 재발 방지) |

## 데이터 모델 (`src/lib/types.ts`)

`ExamSet { metadata, listening: ListeningItem[17], reading: ReadingItem[28] }`
- `ListeningItem`: number, type(유형명), instruction(시험지 지시문 전체 문장), speakers(M/W/Narrator), script(화자별 대사 분리), scriptKo(script와 1:1 대응하는 한국어 해석), choices, answer, explanation, imageRef?, pairGroupId?
- `ReadingItem`: number, type, instruction(시험지 지시문 전체 문장), passage, passageKo, chartData?(25번 도표/27-28번 안내문 — `{caption?, headers, rows}` 표 형태), choices(또는 40번 pairChoices), answer, explanation, keyVocab?, imageRef?, summary?(40번 요약문 완성 전용), pairGroupId?

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
| 3 | HWPX 전체 문항 반복 삽입 + 이미지 삽입 (45문항) | 완료 — 듣기 1-17번 + 독해 18-45번 45문항 전체를 `buildFullExamHwpx()`로 한 hwpx에 조립. 이미지 자체는 placeholder 텍스트로 대체(아래 "알려진 단순화" 참고) |
| 4 | Google Cloud TTS 개별 클립 생성 | 완료 |
| 5 | ffmpeg 병합 (신호음/정적구간 포함) | 완료 — 아래 "오디오 병합 모듈(Phase 5 결과)" 참고 |
| 6 | PDF 렌더러 구축 | 완료 — 아래 "PDF 렌더러 모듈(Phase 6 결과)" 참고 |
| 7 | 프론트엔드 UI 통합 + 진행상태 표시 | 완료 — 아래 "프론트엔드 통합 모듈(Phase 7 결과)" 참고 |
| 8 | Netlify 배포 + Background Function 검증 | 예정 — 사용자가 실제 Netlify 계정으로 직접 진행 예정 |
| 9 | 정답지 별도 출력, 학교스타일 프리셋 등 확장 | 예정 |

## 현재까지 진행 상황 요약 (Phase 1~7 완료, main 병합 완료)

> 다음 세션은 Phase 8부터 시작하면 된다. 아래는 그 전에 파악해야 할 현재 상태 요약.

### Phase별 핵심 산출물

| Phase | 핵심 산출물 |
|---|---|
| 1 | `src/lib/gemini.ts`(듣기/독해 Gemini 호출 + Zod/JSON Schema 이중 검증), `src/lib/apiKeyStorage.ts` + `ApiKeySettings.tsx`(BYOK 키를 localStorage에만 저장) |
| 2 | `scripts/hwpx-poc.ts` — `templates/hwpx-template/`(고등부.hwpx 압축 해제본)에서 1번 문항 조각을 추출해 텍스트만 치환하는 최소 PoC |
| 3 | `src/lib/hwpx/`(listeningSection.ts, readingSection.ts, buildHwpx.ts) — 듣기 1-17 + 독해 18-45 **45문항 전체**를 `buildFullExamHwpx()`로 한 hwpx에 조립. 정답/해설/해석은 각주(`hp:endNote`)로 숨김. `npm run hwpx:full-exam-poc`로 검증 |
| 4 | `src/lib/tts/`(voices.ts, googleTts.ts) + `netlify/functions/generate-audio-background.ts` — Google Cloud TTS Chirp3-HD로 화자별 개별 클립 생성(Background Function, 아래 "실사용 중 발견된 버그" 참고) |
| 5 | `src/lib/audio/`(buildMergePlan.ts, ffmpegMerge.ts, timing.ts) + `netlify/functions/merge-audio-background.ts`(Background Function) + `get-merged-audio.ts`(폴링) — 신호음/정적구간 포함 최종 mp3 병합. `npm run test:merge-audio`로 검증 |
| 6 | `src/lib/pdf/`(react-pdf 기반, 한글 서브셋 폰트 `templates/pdf-template/fonts/`) + `netlify/functions/export-pdf.ts` — 표지+2단 문제지+정답/해설 섹션 PDF. `npm run pdf:full-exam-poc`로 검증(총 10페이지, 눈으로 확인) |
| 7 | `src/components/`(ExamOptionsForm, GenerationProgress, DownloadPanel) + `src/lib/apiClient.ts` + `src/lib/audioOrchestration.ts` + `netlify/functions/export-hwpx.ts`(신규) — `App.tsx`에서 옵션→Gemini→(TTS 있으면)음성합성/병합→HWPX→PDF→다운로드 전체 파이프라인 연결 |

### Netlify 실제 배포 검증 현황 (Phase 8 진행 중 — 사용자가 직접 배포·테스트)

Phase 8은 사용자가 실제 Netlify 계정으로 진행 중이며, 실사용 테스트에서 나온 문제를 세션에서 그때그때
수정해왔다. **각 항목은 "고쳤다"이지 "실제로 성공했다"가 아니다** — 다음 재배포·재테스트에서 확인 필요:

- ✅ **Gemini 문항 생성 — pairChoices 수정 후 실제 성공 확인됨**: 듣기 17문항 + 독해 28문항 정상 생성(사용자 실테스트로 확인)
- 🔧 **TTS 생성 — 502(MissingBlobsEnvironmentError) 발견 → 수정, 재검증 필요**: Background Function은 일반 동기 함수와 달리 Netlify Blobs 컨텍스트(siteID/token)가 자동으로 주입되지 않는 경우가 있었다. `src/lib/netlifyBlobsStore.ts`(신규)의 `connectBlobsForBackgroundFunction(event)`로 raw Lambda 이벤트의 blobs 컨텍스트를 직접 연결하도록 수정. 아래 "Netlify Blobs 모듈" 절 참고. **이 수정이 실제로 통했는지 다음 배포에서 재확인 필요 — 안 되면 Phase 8 체크리스트의 NETLIFY_BLOBS_TOKEN 수동 설정 시도**
- 🔧 **HWPX/PDF 생성 — 502(`fileURLToPath` TypeError) 발견 → 수정, 재검증 필요**: 이전 세션에서 ENOENT를 고치려 도입한 `resolveTemplateDir.ts`가 `import.meta.url`에 의존했는데, Netlify가 함수를 esbuild로 CJS 번들링하면서 `import.meta`가 빈 객체로 치환돼 `import.meta.url`이 `undefined`가 되고, `fileURLToPath(undefined)`가 TypeError를 던지고 있었다. `resolveTemplateDir.ts`를 이 값이 없어도 크래시하지 않도록 방어적으로 수정하고, `process.cwd()`/`LAMBDA_TASK_ROOT` 기반 후보를 추가함. `merge-audio-background.ts`의 `resolveFfmpegPath`도 동일한 `import.meta.url` 문제가 잠재해 있어(TTS를 통과해야 도달하는 다음 단계라 아직 실제로 보고되지 않았을 뿐) 선제적으로 함께 수정. 아래 "배포 시 유의사항" 절 참고. **이 수정이 실제로 통했는지 다음 배포에서 재확인 필요**
- ❓ **`merge-audio-background.ts` / `ffmpeg-static`**: TTS 자체가 아직 끝까지 성공한 적이 없어 그 다음 단계인 병합까지는 도달 못 해봄. TTS가 이번 수정으로 통과하면 다음으로 확인할 대상

### Phase 8 다음 확인 체크리스트

1. **재배포 후 HWPX/PDF 콜드 스타트 로그 확인**: Netlify 대시보드 → Functions → `export-hwpx`/`export-pdf` → Logs에서 `exists=true`인지, `cwd`/`LAMBDA_TASK_ROOT` 값이 무엇인지 확인(위 "배포 시 유의사항" 참고) — `exists=false`면 `included_files` 자체가 안 먹힌 것이므로 "Clear cache and deploy site"로 캐시 초기화 재배포 시도
2. **TTS 재테스트**: 이제 Background Function이라 프론트에서 잠깐 폴링 상태가 보여야 정상 — `generate-audio-background`/`get-audio-clips` 함수 로그도 확인
3. **`ffmpeg-static` 설치 여부 확인**: Netlify 빌드 로그에서 `ffmpeg-static`의 postinstall이 성공하는지(TTS가 통과해야 이 단계까지 실제로 도달함)
4. **`@netlify/blobs` 동작 확인**: 이제 `audio-clip-jobs`, `audio-merge-jobs` 두 스토어를 사용 — `connectBlobsForBackgroundFunction`(아래 "Netlify Blobs 모듈" 절)으로 Background Function에서도 정상 동작하는지. 만약 재배포 후에도 `MissingBlobsEnvironmentError`가 재현되면, Netlify 사용자 설정 → Applications에서 Personal Access Token을 발급해 사이트 환경변수 `NETLIFY_BLOBS_TOKEN`으로 등록(수동 폴백 경로, 코드에 이미 반영돼 있어 이 환경변수만 추가하면 됨)
5. **엔드투엔드 전체 성공 확인**: Gemini → TTS(폴링) → 병합(폴링) → HWPX/PDF 다운로드까지 브라우저에서 한 번 끝까지 성공하는 것 확인
6. **HWPX/PDF 결과물 육안 확인**: 실제 생성된 hwpx를 한글에서, pdf를 뷰어에서 열어 CLI로 검증한 내용(줄바꿈, 2단 배분, 각주, 이미지 placeholder 등)이 동일하게 보이는지
7. **HWPX 출력 파일명 ASCII 확인**: 다운로드 파일명이 한글 파일명 깨짐 없이 내려가는지(설계스펙 6절)

## 환경변수

앱 자체는 서버 환경변수로 API 키를 보관하지 않는다(BYOK). 아래는 개발용 Node CLI 테스트 스크립트 전용:

```
GEMINI_API_KEY=                    # scripts/test-gemini.ts 전용 (앱 런타임과 무관)
GOOGLE_CLOUD_TTS_API_KEY=          # scripts/test-tts.ts 전용 (앱 런타임과 무관)
```

## Gemini 문항 생성 모듈 (Phase 1 결과, 설계스펙 4절)

`src/lib/gemini.ts` — 듣기(`generateListening`)/독해(`generateReading`) 각각 Gemini `responseSchema`(자체 JSON 스키마 강제)로 호출한 뒤, Zod(`listeningItemZod`/`readingItemRawZod`)로 한 번 더 검증하는 이중 구조. `callGeminiJson`이 최대 3회(`MAX_ATTEMPTS`) 재시도하는 공용 헬퍼.

### ⚠️ 실사용 중 발견된 버그: 40번(요약문 완성) `pairChoices` Zod 검증 실패로 매 시도 전부 실패

**증상**: 브라우저 콘솔에 Zod 에러 `{"code":"too_big","maximum":2,...,"path":["items",5,"pairChoices"]}`가 찍히며 3회 재시도 전부 실패. `path`의 `items[5]`는 `readingResponseSchema`가 감싸는 `items` 배열의 인덱스(0-based)라 실제로는 그 배치의 **6번째 문항**을 가리키는 것으로, 40번(요약문 완성) 자체가 6번째로 응답된 경우이거나 —Gemini가 40번이 아닌 문항에도 `pairChoices` 필드를 채워 보낸 경우—둘 다일 수 있었다(원본 응답 로그가 없어 이번 수정 전에는 확정할 수 없었음).

**원인**: `readingItemRawZod.pairChoices`가 `z.tuple([z.array(choiceZod), z.array(choiceZod)])`로 **정확히 2개 그룹만** 허용하는 엄격한 튜플이었다. Gemini가 (a) 40번에 그룹을 2개보다 많이 생성했거나, (b) 40번이 아닌 다른 문항에도 실수로 `pairChoices`를 채워 보내면 파싱 자체가 예외를 던져 그 배치(18-34는 17문항, 35-45는 11문항) 전체가 재시도됐다.

**수정** (`src/lib/gemini.ts`):
1. Gemini 쪽 `responseSchema`의 `pairChoices`에 `minItems: '2', maxItems: '2'`를 추가해 애초에 Gemini가 2개보다 많거나 적은 그룹을 생성할 가능성을 줄임(완전한 보장은 아님 — Gemini가 스키마를 100% 지키지 않을 수 있어 아래 2, 3번이 실제 방어선).
2. Zod 쪽은 엄격한 2-튜플 대신 `z.array(z.array(choiceZod)).nullable().optional()`로 완화 — 그룹 개수와 무관하게 일단 파싱은 통과시킨다.
3. `normalizeReadingItem`에서 `number === 40`(요약문 완성 문항 번호, `SUMMARY_ITEM_NUMBER` 상수)일 때만 `pairChoices`를 사용하도록 명시적으로 게이팅. 그룹이 2개보다 많으면 앞의 2개만 사용하고 `console.warn`으로 경고, 2개 미만이면 에러를 던짐(40번인데 데이터가 근본적으로 부족한 경우). **40번이 아닌 문항은 `pairChoices`에 어떤 값이 와도 완전히 무시**하고 항상 `choices` 필드만 사용.
4. `callGeminiJson`의 catch 블록에 Gemini가 실제로 응답한 원본 JSON 텍스트를 `console.warn`으로 남기도록 추가(`text` 변수를 try 블록 바깥에 선언해 catch에서도 접근 가능하게 함) — 이번처럼 Zod 에러의 `path`만으로는 원인을 확정할 수 없는 경우, 다음부터는 브라우저 콘솔에서 원본 응답을 바로 확인할 수 있음.

로컬에서 `readingItemRawZod`/`normalizeReadingItem`을 일시적으로 `export`해 3가지 케이스(40번에 그룹 3개, 40번이 아닌 25번에 잘못 섞여 들어온 pairChoices, 40번에 그룹 1개만 온 경우)를 직접 실행해 의도대로 동작함을 확인한 뒤 다시 비공개로 되돌렸다. **실제 Gemini 응답으로 재현된 것은 아니라 다음 실배포 테스트에서 최종 확인 필요.**

## HWPX 템플릿 (Phase 2·3 결과, 설계스펙 6절)

- 실제 이언어학원 템플릿 `고등부.hwpx`를 압축 해제해 `templates/hwpx-template/`에 원본 그대로 보관 (mimetype, Contents/*, BinData/*, Preview/*, META-INF/*, settings.xml)
- `Contents/section0.xml`이 실제 문항 본문. **듣기 문항의 영어 대본/한국어 해석/정답/해설은 문제 번호 텍스트 뒤에 각주(`hp:endNote`)로 숨겨져 있는 구조** — 화면에는 문제 지시문만 보이고, 각주를 펼치면 대본·해석·정답·해설이 나옴
- `ListeningItem.scriptKo: string[]`, `ListeningItem.instruction: string` — 각각 한국어 해석, 시험지 지시문 전체 문장. Gemini 프롬프트(`listeningPrompt.ts`)에도 생성 지시 반영 완료
- ⚠️ **우리 템플릿에는 처음부터 진짜 다단(2단) 설정이 있었음**: `section0.xml` 최상단(첫 문단, `secPr` 직후)에 `<hp:colPr type="NEWSPAPER" colCount="2" sameGap="2268">` 컨트롤이 있어 문서 전체(듣기+독해)가 이미 2단으로 흐르도록 되어 있다 — Phase 2/3 최초 분석 때 "colDef/multiCol/column" 패턴만 검색하고 "colPr"을 놓쳐서 못 찾았던 것. 즉 문항은 좌/우를 직접 나눌 필요 없이 **순서대로 이어붙이기만 하면 HWP가 자동으로 컬럼에 배분**한다.

### 독해(18-45) 실제 템플릿 확보 — 신규 레이아웃을 실측값으로 보정

처음엔 독해 구간이 없는 `고등부.hwpx`만 있어 레이아웃을 새로 설계했으나(설계 배경은 아래 "신규 레이아웃 설계 배경" 참고), 이후 사용자가 **① 실제 수능 영어영역 문제지 PDF**, **② 45문항 전체가 채워진 실제 hwpx 참고 파일**을 제공해 형식만 참고해 아래처럼 대폭 보정했다(지문·문항 텍스트는 어디서도 사용하지 않음):

- **표/박스를 쓰지 않는다** — hwpx 참고자료 확인 결과 25번(도표)·27-28번(안내문)은 표가 아니라 **BinData에 저장된 실제 이미지**로 삽입되어 있었고, 41-42/43-45번 공유 지문도 테두리 박스 없이 **일반 문단**이었다. 이전 버전에서 만들었던 `wrapInTwoColumnTable`(표 기반 2단), `wrapInBorderedBox`(테두리 박스), `buildDataTableXml`(도표/안내문 표), `renderChartReadingItem`/`renderNoticeReadingItem`(표+박스 렌더러)를 전부 제거했다.
- **2단 편집은 표가 아니라 위에서 설명한 기존 `hp:colPr`을 그대로 활용** — 문항 조각을 순서대로 이어붙이기만 하면 됨. `distributeIntoColumns`(좌/우 수동 배분)도 불필요해져 제거.
- **정답/해설/해석(한국어 지문 해석)은 듣기와 동일하게 각주(`hp:endNote`)로 숨겨 "미주 답지" 형태로 구현** — 참고 hwpx 자체는 독해에 각주를 쓰지 않았지만, 사용자가 명시적으로 요청해 반영(문항 본문은 절대 각주 안에 넣지 않음).
- `ReadingItem.passageKo: string` 필드 추가(지문 전체 한국어 해석, `scriptKo`와 동일한 이유로 필요해 추가) — Gemini 프롬프트(`readingPrompt.ts`)에도 생성 지시 반영
- `readingStyleConfig.ts`의 컬럼 폭/간격을 실제 hwpx 참고자료에서 실측한 값(`columnGap=2268`은 `hp:colPr`의 `sameGap` 실측값, `columnWidth=24376`은 문서 내 실제 lineseg 실측값)으로 교체 — PDF 비율 기반 추정치보다 훨씬 정확함

**구현 완료**: `src/lib/hwpx/readingSection.ts`
- `renderStandardReadingItem` — 18-39 등 표준형(지문+선택지), 25/27/28도 `imageRef` 설정 시 자동으로 placeholder 이미지가 들어가므로 이 함수 하나로 처리(표/박스 없음, 정답/해설/해석/핵심어휘는 각주에 숨김)
- `renderSummaryReadingItem` — 40번(요약문 2빈칸): `pairChoices`를 5개 조합 선택지로 렌더링. 요약문 자체는 `ReadingItem.summary` 필드(Phase 3 완료 작업에서 추가, 아래 참고)에서 가져옴
- `renderSharedPassageGroup` — 41-42/43-45(장문 공유 지문): 지문은 일반 문단으로 한 번만 넣고 하위 문항 여러 개를 이어붙임(박스 없음)
- `buildReadingSectionXml(reading: ReadingItem[])` — **Phase 3 마무리 작업에서 추가.** 18~45번 28문항을 번호 순서대로 순회하며 위 세 렌더러에 분배해 하나의 XML로 조립(18-39 표준형 → 40 요약문 → 41-42 공유지문 → 43-45 공유지문)
- `imagePlaceholderParagraph` — 이미지가 필요한 문항(`imageRef` 설정 시) `[이미지 자리표시 — ...]` 안내 텍스트 문단으로 표시(실제 이미지 생성 파이프라인은 미도입). 처음엔 BinData의 기존 이미지(`image1.jpg`)를 `hp:pic`으로 재사용했으나, 그 이미지가 실제로는 이언어학원 뒷표지 배경 그림이라 엉뚱하게 작게 삽입되는 버그가 있어(아래 "실사용 중 발견된 버그" 참고) 텍스트 방식으로 교체함
- `buildHwpx.ts`의 `buildReadingSectionPoCHwpx(readingSectionXml)` — 원본 문서(표지+듣기 1-17번)는 그대로 두고 문서 맨 끝(정답 라벨 앞)에 독해 문항을 순서대로 이어붙임(좌/우 배분 로직 없음). 문항 개수와 무관하게 동작하므로 3문항 PoC든 28문항 전체든 그대로 재사용
- `buildHwpx.ts`의 `buildFullExamHwpx(listening, reading)` — **Phase 3 완료 작업에서 추가.** 듣기 1-17번 교체 + 독해 18-45번 삽입을 한 번에 처리해 45문항 전체가 채워진 hwpx 하나를 생성하는 최종 진입점
- `scripts/hwpx-reading-poc.ts` (`npm run hwpx:reading-poc -- <경로>`) — 18번+25번+27번 3문항 소규모 검증용, 유지
- `scripts/hwpx-full-exam-poc.ts` (`npm run hwpx:full-exam-poc -- <경로>`) — **Phase 3 완료 검증용.** 듣기 17문항 + 독해 28문항(40번 pairChoices, 41-42/43-45 공유지문 포함) 테스트 데이터로 45문항 전체 hwpx를 생성. mimetype STORED+첫 엔트리, XML well-formed, 각주(`hp:endNote`) 번호 1~45 전부 유일하게 존재, "정답" 라벨이 모든 문항 뒤에 위치, 원본 템플릿 문구 유출 없음, 문단별 lineseg 개수가 텍스트 길이에 비례(1개 고정 아님)를 확인 완료

### 실사용 중 발견된 버그와 수정 (한글에서 실제로 열어본 뒤 발견)

독해 데모 파일을 한글에서 직접 열어본 사용자 피드백으로 아래 3가지 문제를 발견·수정함:

1. **문단 줄바꿈 겹침 버그**: 문단마다 `<hp:lineseg>`를 정확히 1개만 넣었더니, 실제로 여러 줄로 줄바꿈되는 독해 지문·긴 해설 등에서 한글이 몇 줄로 나뉘는지 몰라 모든 줄이 같은 위치에 겹쳐 그려졌다(선택지처럼 원래 한 줄짜리 짧은 텍스트로만 테스트했을 때는 우연히 문제가 드러나지 않았음). `textUtils.ts`에 `buildLinesegArrayForText`/`buildSimpleParagraphXml`을 추가해, 컬럼 폭 기준 한글/영어 평균 글자 수로 줄바꿈 지점을 근사 계산하고 그 줄 수만큼 `lineseg` 항목을 생성하도록 수정(정확한 폰트 기반 줄바꿈은 아니지만 겹침은 방지됨). `readingSection.ts`(`simpleParagraph`, `stemParagraph`)와 `listeningSection.ts`(전체, 아래 참고) 양쪽 모두 적용.
2. **잘못된 이미지 placeholder**: 25/27번 이미지 자리에 재사용했던 BinData `image1.jpg`가 실제로는 이언어학원 뒷표지 배경 그림이라 시험지 본문에 엉뚱하게 작은 워터마크처럼 삽입되었다. `<hp:pic>` 참조를 완전히 제거하고 `[이미지 자리표시 — ...]` 텍스트로 대체.
3. **삽입 위치 오류**: 새 독해 섹션을 `</hs:sec>` 바로 앞에 삽입했더니 문서 맨 끝의 "정답" 라벨 문단보다 뒤에 붙어, 렌더링 결과에서 "정답" 글자가 18번 문항 바로 앞에 나타나는 것처럼 보였다. `buildHwpx.ts`의 `buildReadingSectionPoCHwpx`를 "정답" 라벨 문단을 찾아 그 앞에 삽입하도록 수정(`TAIL_LABEL_MARKER`).

이 중 1번(줄바꿈 겹침)은 독해 지문처럼 원래도 여러 줄인 텍스트에서만 드러나는 버그라, 사용자가 아직 테스트하지 않은 듣기 섹션(`listeningSection.ts`)에도 동일하게 잠재해 있었다. 사용자 리포트 전에 선제적으로 발견해 아래처럼 같이 수정함.

### 신규 레이아웃 설계 배경 (독해 템플릿 확보 전 1차 시도, 현재는 위 내용으로 대체됨)

업로드된 `고등부.hwpx`에는 처음엔 **듣기 1-17번만 있고 독해 18-45번 구간이 아예 없었다** (`section0.xml`을 전수 분석해 확인 — 총 top-level 문단 167개가 모두 표지+듣기17문항+"정답" 라벨로 끝남). 실제 이언어학원 독해 템플릿을 구하기 전까지, 사용자가 제공한 실제 수능 영어영역 문제지 PDF(2026학년도, A3 842×1191pt)의 여백/컬럼 비율만 추출해 1차로 레이아웃을 만들었으나, 그 과정에서 표 기반 2단·테두리 박스 등을 임의로 설계했던 부분은 이후 실제 hwpx 참고자료로 전부 재검증/수정되었다(위 절 참고).

### Phase 3 완료 범위: 듣기 1-17번 전체 조립

- `src/lib/hwpx/` (Node 전용, `tsconfig.app.json`에서 제외돼 브라우저 번들에는 포함 안 됨):
  - `paths.ts`, `textUtils.ts` — 경로 상수, XML 이스케이프/원문자 변환, 줄바꿈 lineseg 계산(`buildLinesegArrayForText`/`buildSimpleParagraphXml`)
  - `listeningFragment.ts` — Phase 2 PoC(1번 문항 단일 치환, `listening-single-line.template.xml` 사용)용, 유지
  - `listeningSection.ts` — **Phase 3 핵심**. `buildListeningSectionXml(listening: ListeningItem[])`이 17문항 전체를 조립. ⚠️ 처음엔 `templates/hwpx-template/fragments/`의 정적 템플릿 3종(`listening-line`/`listening-item`/`listening-1617-pair`.template.xml)에 텍스트만 치환하는 방식이었으나, (a) 각 템플릿이 고정 개수의 `lineseg`만 가지고 있어 독해 섹션과 동일한 줄바꿈 겹침 버그가 잠재해 있었고 (b) `listening-1617-pair.template.xml`의 "▪선택지해석:" 블록에 실제 참고 원본 시험지의 진짜 내용(예: "① 전통적 농업과 도시 농업의 비교")이 파라미터화되지 않은 채 하드코딩되어 있어 생성물마다 그대로 노출되는 문제가 있었다. 두 문제를 근본적으로 없애기 위해 독해 섹션(`readingSection.ts`)과 동일한 방식(텍스트 길이에 맞춰 그때그때 XML을 동적으로 생성)으로 전면 재작성했고, 정적 템플릿 3개 파일은 삭제함("▪선택지해석" 블록은 파라미터화하지 않고 통째로 제거 — `Choice` 타입에 선택지 번역 필드가 없어 애초에 생성할 수도 없었음).
  - `buildHwpx.ts` — `buildListeningPoCHwpx`(Phase 2, 문항 1개) + `buildListeningExamHwpx`(Phase 3, 듣기 섹션 전체 교체, `jszip` 재압축·mimetype STORE 유지)
- `scripts/hwpx-poc.ts` (`npm run hwpx:poc -- <경로>`, 문항 1개), `scripts/hwpx-listening-poc.ts` (`npm run hwpx:listening-poc -- <경로>`, 17문항 전체) — 둘 다 원본과 뚜렷이 구분되는 테스트 데이터로 검증됨(mimetype STORED, XML 유효성, 신규/원본 내용 대조, 표지·문서 끝부분 보존 확인)

### 알려진 단순화(추후 보강 필요)

- **4번(그림 불일치)**: 원본은 그림 위에 ①~⑤ 위치 라벨이 찍힌 이미지 문제. 지금은 표준 텍스트 5지선다로 대체(`imageRef`는 정보용 문자열일 뿐 실제 이미지 삽입 없음) — 실제 그림 생성/삽입 파이프라인 필요
- **10번(표 문제)**: 원본은 비교표(호텔 등) 삽입. 지금은 표준 텍스트 5지선다로 대체 — 구조화된 표 데이터 필드와 표 렌더링 로직 필요
- **11-17번 "▪선택지해석"(영어 선택지의 한국어 번역) 블록**: 원본엔 있지만 `Choice` 타입에 선택지 번역 필드가 없어 생성물에서는 완전히 생략됨(위 "실사용 중 발견된 버그" 참고 — 한때 정적 템플릿에 원본 내용이 하드코딩된 채 남아있던 것을 발견해 제거함)
- **독해 25/27/28번 이미지 placeholder**: 실제로는 표가 아니라 이미지이지만 이미지 생성 파이프라인이 없어 안내 텍스트로 대체(위 "실사용 중 발견된 버그" 참고)
- **41-42/43-45 공유 지문의 한국어 해석 중복**: `renderSharedPassageGroup`은 영어 지문은 한 번만 넣지만, 각 하위 문항이 자기 `passageKo`를 각자의 각주에 넣다 보니 공유 지문의 한국어 해석이 하위 문항 수만큼(41-42는 2번, 43-45는 3번) 반복 삽입된다. 틀린 내용은 아니지만 불필요한 중복 — 그룹당 한 번만 넣도록 개선 검토 필요

## TTS 모듈 (Phase 4 결과, 설계스펙 5절)

- `netlify.toml` 신규 생성 (functions 디렉터리 = `netlify/functions`, SPA fallback redirect)
- `src/lib/tts/`:
  - `voices.ts` — 화자(M/W/Narrator)별 Chirp3-HD 보이스 고정 매핑(⚠️ 설계스펙에 예시로 제시된 보이스명이므로 실사용 전 Google Cloud 콘솔에서 최신 목록 확인 필요), 기본 속도 배율(`DEFAULT_SPEAKING_RATE`)
  - `googleTts.ts` — Google Cloud TTS REST API(`texttospeech.googleapis.com/v1/text:synthesize`) 호출. **Chirp3-HD 보이스는 SSML `<prosody>` 태그를 지원하지 않아** 설계스펙의 SSML 방식 대신 `audioConfig.speakingRate`(합성 API 전역 파라미터)로 속도를 조절하도록 구현(기술적 판단 변경, 결과는 동일)
  - `types.ts` — `TtsLineRequest`/`TtsLineResult` (호출자가 id로 결과를 재매칭)
  - 에러 메시지에 API 키가 절대 노출되지 않도록 처리(URL의 `?key=` 대신 상태코드/메시지만 노출)
- `netlify/functions/generate-audio-background.ts`(원래는 동기 함수 `generate-audio.ts`였으나 Background Function으로 전환됨 — 아래 "실사용 중 발견된 버그" 참고) — BYOK 원칙대로 사용자의 TTS 키를 요청 body로만 받아 그 호출 처리 중에만 사용(저장 안 함), `src/lib/tts/googleTts.ts`의 `synthesizeLines`를 그대로 재사용
- `scripts/test-tts.ts` (`npm run test:tts -- <출력폴더>`) — 화자 3종 샘플 문장을 실제로 합성해 mp3로 저장하는 개발자용 CLI. 이 세션 환경에서는 실제 TTS 키가 없어 최종 오디오 청취 검증은 못했음(Node `fetch`로 Google TTS 엔드포인트까지 도달하는 것은 확인) — 사용자가 실제 `GOOGLE_CLOUD_TTS_API_KEY`로 직접 실행해 음질/속도 확인 필요

## 오디오 병합 모듈 (Phase 5 결과, 설계스펙 5절)

**병합 로직과 ffmpeg 바이너리 경로를 분리** — `src/lib/audio/`(순수 로직, `fs`/`child_process`는 쓰지만 `ffmpeg-static`에는 의존하지 않음)와 `netlify/functions/`(실제 배포 환경 전용 바이너리 연결) 두 층으로 나눴다. 이렇게 나눈 이유: 이 개발 세션 환경은 프록시가 GitHub Releases 직다운로드를 막고 있어 `ffmpeg-static`의 postinstall(바이너리 다운로드)이 실패한다(반면 Netlify 빌드 서버는 인터넷 제한이 없어 정상 설치됨) — 그래서 `ffmpeg-static`은 `package.json`의 `optionalDependencies`로 선언해(설치 실패해도 `npm install` 전체가 안 죽음) 실제 바이너리 경로는 이 패키지가 설치되는 `netlify/functions/merge-audio-background.ts`에서만 참조하고, 재사용 가능한 병합 로직(`src/lib/audio/`)은 ffmpeg 실행 파일 경로를 인자로 주입받게 설계해 `ffmpeg-static` 유무와 무관하게 항상 타입체크·테스트가 가능하도록 했다. 이 세션에서는 `apt-get install ffmpeg`로 시스템 ffmpeg를 설치해 실제 병합 결과물까지 검증 완료.

- `src/lib/audio/types.ts` — `MergeSegment`(`clip`/`silence`/`tone` 판별 유니언)
- `src/lib/audio/timing.ts` — 문항 사이 정적구간 길이 상수. ⚠️ 설계스펙이 예시로 제시한 값("짧은 문항 12~15초 / 16-17번 이후 20초")을 그대로 채택한 잠정치일 뿐, 스펙 자체가 "정확한 초 단위는 최신 평가원 공식 시간 배분표로 확정 필요"라고 명시 — 실사용 전 검증 필요
- `src/lib/audio/buildMergePlan.ts` — `buildListeningMergePlan(listening, clipsById, introClipId?, outroClipId?)`가 `[안내멘트] → [문항별: 신호음 → 대사 클립들 → 정적구간] → [안내멘트]` 순서의 `MergeSegment[]`를 만든다. `buildTtsLineId(itemNumber, lineIndex)`가 TTS 요청/결과 id("1-0" 형식, `tts/types.ts` 참고)와 병합 플랜의 유일한 연결 창구. 16-17번처럼 `script`가 빈 문항(공통 지문이라 이미 앞 문항에서 재생됨)은 자동으로 건너뛰고, `pairGroupId === '16-17'`이면 표준 정적구간 대신 긴 정적구간을 적용
- `src/lib/audio/ffmpegMerge.ts` — `mergeSegmentsToMp3(segments, ffmpegPath)`. `clip`은 임시 mp3 파일로 기록하고 `silence`/`tone`은 ffmpeg `lavfi` 가상 입력(`anullsrc`/`sine`)을 파일 생성 없이 바로 사용, 전체를 `filter_complex concat`으로 이어붙여 24kHz 모노 mp3로 재인코딩(입력 클립들의 인코딩 파라미터가 조금씩 달라도 안전하게 처리하기 위해 스트림 복사 대신 재인코딩 방식 선택)
- `netlify/functions/merge-audio-background.ts` — 파일명이 `-background`로 끝나 Netlify가 자동으로 Background Function으로 인식(동기 함수 10초 제한 대신 최대 15분). `ffmpeg-static`의 바이너리 경로로 `mergeSegmentsToMp3`를 실행하고, 결과(성공 시 mp3, 실패 시 에러 메시지)를 `@netlify/blobs`에 `jobId` 키로 저장 — Background Function은 호출자에게 결과를 직접 반환할 수 없어 폴링용 저장소가 필요하다는 설계스펙 5절의 요구사항 그대로 구현
- `netlify/functions/get-merged-audio.ts` — `GET ?jobId=...`로 폴링하는 동기 함수. `pending`/`error`/완료(mp3 base64 응답) 3가지 상태를 반환
- `scripts/test-merge-audio.ts` (`npm run test:merge-audio -- <출력경로.mp3>`) — 실제 TTS 없이(Phase 4와 동일한 이유로 이 세션엔 키가 없음) 문항마다 다른 주파수의 사인파를 "가짜 대사 클립"으로 합성해 병합 메커니즘만 검증. 세그먼트 수·예상 총 길이를 계산해 놓고, 실제 병합 결과를 `ffprobe`로 재생 길이를 측정해 오차 1초 이내인지 자동 확인(16-17번 특수 정적구간 포함, 4개 문항 테스트 데이터로 62초 산출 → 실측 62.45초로 검증 통과)

### ⚠️ 실사용 중 발견된 버그: TTS 클립 생성도 504 Timeout → Background Function으로 전환

원래 개별 TTS 클립 생성(`generate-audio.ts`)은 동기 함수였다. 실제 Netlify 배포에서 문항이 많아지자
(듣기 17문항, 대사가 많으면 60~100줄 이상) Google Cloud TTS를 줄 단위로 순차 호출하는 데 걸리는
누적 시간이 Netlify 동기 함수의 10초 실행 제한을 넘겨 `504 Gateway Timeout`이 발생했다.
`merge-audio-background.ts`와 동일한 패턴(Background Function + `@netlify/blobs` + 폴링)으로
전환해 해결:
- `netlify/functions/generate-audio-background.ts` — `synthesizeLines`를 실행하고 결과(클립 배열
  또는 에러)를 `audio-clip-jobs` 스토어에 `jobId` 키로 저장. 기존 동기 함수 `generate-audio.ts`는 삭제
- `netlify/functions/get-audio-clips.ts` — `GET ?jobId=...` 폴링 동기 함수, `get-merged-audio.ts`와
  동일한 `pending`/`error`/완료(`{status:'done', clips}`) 3상태 반환
- `src/lib/apiClient.ts`: `requestAudioClips`(단발 호출) 제거, `startAudioClipGeneration`/
  `pollAudioClipsOnce`/`pollAudioClipsUntilDone`으로 교체(병합 폴링과 동일한 모양)
- `src/lib/audioOrchestration.ts`의 `synthesizeListeningAudio`가 이제 클립 생성용 `jobId`와
  병합용 `jobId`를 각각 발급해 **두 번의 Background Function + 폴링 사이클**(클립 생성 → 병합)을
  순서대로 수행

## Netlify Blobs 모듈 (`src/lib/netlifyBlobsStore.ts`)

### ⚠️ 실사용 중 발견된 버그: Background Function에서 `MissingBlobsEnvironmentError`

**증상**: TTS 클립 생성(`generate-audio-background.ts`)이 실제 배포에서 HTTP 502로 실패, 에러 메시지는 `MissingBlobsEnvironmentError: The environment has not been configured to use Netlify Blobs. ... supply siteID, token`. 반면 같은 스토어를 읽는 동기 함수 `get-audio-clips.ts`/`get-merged-audio.ts`는 (한 번도 문제 없이) 정상 동작했다.

**원인**: `@netlify/blobs`의 `getStore()`는 `siteID`/`token`을 명시적으로 넘기지 않으면 `globalThis.netlifyBlobsContext` 또는 `NETLIFY_BLOBS_CONTEXT` 환경변수에서 자동으로 읽어오는데, 이 컨텍스트는 보통 Netlify의 함수 실행 래퍼가 요청을 처리하기 직전에 주입해준다. 그런데 Background Function은 일반 동기 함수와 다른 비동기 Lambda invoke 경로를 타서 이 자동 주입이 누락되는 경우가 있었다(플랫폼 쪽 동작이라 우리 코드로 직접 검증/제어는 불가능).

**수정** (`src/lib/netlifyBlobsStore.ts`, 신규):
1. `@netlify/blobs`가 정확히 이 상황을 위해 제공하는 `connectLambda(event)`를 사용 — Background Function이 받는 raw Lambda 이벤트에 실려 있는 `event.blobs`(base64 인코딩된 컨텍스트)와 `x-nf-site-id` 등의 헤더를 직접 읽어 컨텍스트를 연결한다. `connectBlobsForBackgroundFunction(event)`로 감싸 `event.blobs`가 실제로 존재할 때만 시도하도록 방어적으로 처리(없으면 조용히 건너뛰고 기존 자동 감지에 맡김).
2. 그래도 해결되지 않는 경우를 위한 최종 폴백으로 `getJobStore(name)`을 추가 — `SITE_ID`(Netlify가 모든 함수에 자동 주입, `process.env.SITE_ID`)와 `NETLIFY_BLOBS_TOKEN`(자동 주입되지 않음 — 사용자가 Netlify 대시보드에서 Personal Access Token을 발급해 사이트 환경변수로 직접 등록해야 함) 둘 다 있으면 `getStore({ name, siteID, token })`으로 수동 설정, 없으면 기존 `getStore(name)` 자동 감지로 폴백.
3. `generate-audio-background.ts`/`merge-audio-background.ts`(Background Function)와 `get-audio-clips.ts`/`get-merged-audio.ts`(동기 폴링 함수) 네 곳 모두 이 공용 헬퍼를 쓰도록 통일. Background Function 쪽은 핸들러 맨 앞에서 `connectBlobsForBackgroundFunction(event)`을 호출한 뒤에 `getJobStore()`를 호출해야 한다(순서가 바뀌면 컨텍스트 연결 전에 스토어를 생성하게 되어 효과가 없음).

**실제 Netlify 배포에서 재현된 상황을 이 세션에서 직접 고쳐 재배포 검증을 요청한 것으로, connectLambda 방식이 실제로 통하는지는 다음 재배포에서 최종 확인 필요.** 안 통하면 위 2번 폴백(`NETLIFY_BLOBS_TOKEN` 환경변수 등록)을 시도하면 된다.

## PDF 렌더러 모듈 (Phase 6 결과, 설계스펙 7절)

HWPX와 완전히 별도 파이프라인(설계스펙 7절 "방식 A")으로 `@react-pdf/renderer`(fontkit 기반, 브라우저/헤드리스 브라우저 불필요)를 사용. Puppeteer 방식(B안)은 서버리스 함수에 헤드리스 Chromium을 번들해야 해서 ffmpeg-static과 같은 종류의 무거운 바이너리 문제가 또 생기므로 채택하지 않았다.

**한글 폰트 임베딩이 핵심 이슈였다** — PDF 표준 14개 내장 폰트는 한글을 지원하지 않는다. `templates/pdf-template/fonts/NotoSansKR-{Regular,Bold}.otf`를 커밋해 사용하는데, 이 폰트는:
- Google Fonts의 원본 Noto Sans CJK는 언어별 서브폰트가 하나의 TTC(TrueType Collection)로 묶여 있고, 그마저도 한 파일에 17MB대라 그대로 커밋하기엔 크다.
- Ubuntu `fonts-noto-cjk`(apt) 패키지로 시스템에 설치한 TTC에서 `fontTools`(Python)로 "Noto Sans CJK KR" 서브폰트(index 1)만 추출한 뒤, 실제 시험지에 쓰이는 문자 범위(라틴 전체·한글 완성형/자모·문장부호·원문자 등)만 `fonttools subset`으로 잘라내 폰트당 2MB 내외(Regular+Bold 합쳐 4MB)로 줄였다.
- npm의 `@fontsource/noto-sans-kr`는 언어별로 쪼개진 서브셋 woff2만 제공해서(한글 전용 서브셋에는 라틴 문자가 없음) 영어+한글이 섞인 우리 문항에는 그대로 못 썼다 — 이 실패 시도 끝에 위 OTF 추출 방식으로 전환.
- ⚠️ 서브셋에 한자(CJK 통합 한자, 예: 心境)는 포함하지 않았다 — 실제 수능 지문에는 한자를 쓰지 않으므로 의도적으로 제외. 테스트 데이터에 실수로 한자가 들어갔다가 글자가 통째로 빠져 보이는 문제를 발견해 데이터를 수정했다(폰트 문제가 아니라 테스트 데이터 오타였음).

**실제 시험지에는 정답/해설/해석/핵심어휘가 보이지 않는다** — HWPX가 이 정보를 각주(`hp:endNote`)로 숨기는 것과 동일한 이유로, PDF도 "문제지 본문"과 "정답 및 해설" 섹션을 분리했다.

- `src/lib/pdf/fonts.ts` — `ensureFontRegistered()`가 `Font.register()`로 위 OTF 2종을 한 번만 등록(멱등)
- `src/lib/pdf/layout.ts` — A4 페이지/2단 컬럼 치수(pt 단위) 상수와, HWPX의 lineseg 추정과 같은 방식(글자 폭 근사치)의 텍스트 줄 수 추정 함수. 실제 폰트 메트릭 기반 계산이 아니라 대략적인 근사치
- `src/lib/pdf/blocks.ts` — `ExamBlock`(`listening`/`reading-standard`/`reading-summary`/`reading-shared-group` 판별 유니언, "문제지 본문에 실제로 인쇄되는 내용"만 표현)과 `buildExamBlocks(listening, reading)`이 45문항을 순서대로 이 블록들로 변환. `estimateBlockHeight()`로 블록별 예상 높이(pt)를 구하고, `paginateIntoColumns()`가 좌→우 컬럼, 컬럼이 차면 다음 페이지 순으로 블록을 배분(41-42/43-45처럼 긴 공유지문 블록이 빈 컬럼보다 커도 다음 컬럼으로 무한정 넘기지 않고 그 컬럼에 그대로 채움)
- `src/lib/pdf/components/` — `CoverPage`(표지: 회차명/영어영역/학원 지점/학년), `ExamColumnPageView`(2단 컬럼 페이지 하나), `ExamBlockView`(블록 종류별 렌더링), `AnswerKeySection`(정답/해석/해설/핵심어휘 — 학생용 문제지에는 없는 별도 섹션), `ExamDocument`(위 전부를 하나의 `<Document>`로 조립)
- `src/lib/pdf/buildPdf.tsx` — `buildExamPdf(examSet): Promise<Buffer>`. `renderToBuffer`(Node 전용, 브라우저/Puppeteer 불필요)로 최종 PDF 생성
- `netlify/functions/export-pdf.ts` — PDF 렌더링은 45문항 기준 1초 미만으로 빨라 ffmpeg 병합과 달리 Background Function 없이 동기 함수로 처리
- `scripts/pdf-full-exam-poc.ts` (`npm run pdf:full-exam-poc -- <출력경로.pdf>`) — hwpx-full-exam-poc.ts와 동일한 45문항 픽스처(`scripts/fixtures/sampleExamSet.ts`로 공유 추출)로 PDF 생성. `pdftoppm`/`pdftotext`(poppler-utils)로 각 페이지를 이미지·텍스트로 뽑아 실제로 눈으로 확인: 표지, 2단 배분, 25/27/28 이미지 placeholder, 40번 요약문 조합 선택지, 41-42/43-45 공유지문(지문 한 번만 인쇄), 정답 및 해설 섹션까지 전부 정상 렌더링 확인(총 10페이지 산출)
- ⚠️ `tsx` CLI가 프로젝트 루트의 `tsconfig.json`(참조 전용, 자체 `jsx` 설정 없음)을 기본으로 읽어 JSX를 classic 방식으로 잘못 변환하는 문제가 있어, `pdf:full-exam-poc` 스크립트는 `tsx --tsconfig tsconfig.scripts.json`으로 명시적으로 지정(다른 스크립트들은 이 문제가 없어 그대로 둠 — JSX를 쓰는 스크립트가 이번이 처음)

## 프론트엔드 통합 모듈 (Phase 7 결과)

설계스펙의 전체 데이터 흐름(옵션 선택 → Gemini → TTS → ffmpeg 병합 → HWPX/PDF 주입 → 다운로드)을 `App.tsx`에서
하나의 파이프라인으로 연결하고 단계별 진행상황을 표시한다.

- `src/components/ExamOptionsForm.tsx` — 연도/학년/학원지점/EBS연계/학교스타일 옵션 입력
- `src/components/GenerationProgress.tsx` — `{key, label}[]` 스텝 목록 + 현재 키를 받아 완료/진행중/대기 상태를 표시하는 범용 컴포넌트(TTS 키 유무에 따라 "음성 합성" 단계가 있고 없고를 동적으로 반영)
- `src/components/DownloadPanel.tsx` — HWPX/PDF/MP3/JSON 다운로드 버튼(MP3는 TTS 키가 없거나 병합 실패 시 버튼 대신 사유 안내 문구 표시)
- `src/lib/apiClient.ts` — 브라우저에서 Netlify Functions를 호출하는 fetch 래퍼(`generate-audio-background`+`get-audio-clips` 폴링, `merge-audio-background`+`get-merged-audio` 폴링, `export-hwpx`, `export-pdf`). Gemini 호출과 달리 이 함수들은 서버 리소스(ffmpeg/jszip/fontkit)가 필요해 서버리스 함수를 거친다
- `src/lib/audioOrchestration.ts` — `synthesizeListeningAudio(ttsApiKey, listening)`가 대사별 TTS 요청 생성 → `generate-audio-background` 트리거+`get-audio-clips` 폴링 → `buildListeningMergePlan`(오디오 병합 모듈, Phase 5)으로 병합 플랜 구성 → `merge-audio-background` 트리거+`get-merged-audio` 폴링까지 한 번에 처리해 최종 mp3 Blob을 반환(Background Function 두 번 + 폴링 두 번). `src/lib/audio/buildMergePlan.ts`가 Node 전용 API(fs/child_process)에 의존하지 않는 순수 로직이라 브라우저에서도 그대로 재사용 가능했음
- `netlify/functions/export-hwpx.ts` — **Phase 7에서 신규 추가.** `buildFullExamHwpx`를 감싸는 동기 함수(export-pdf.ts와 동일한 패턴). 이전까지는 CLI 스크립트에서만 호출되고 있어 프론트엔드에서 HWPX를 요청할 방법이 없었음
- `src/lib/gemini.ts`의 `generateExamSet`에 `onProgress?: (stage) => void` 콜백 추가(`GenerationStage = 'listening' | 'reading-18-34' | 'reading-35-45' | 'done'`) — `App.tsx`가 이 콜백을 그대로 진행상황 상태에 연결
- `App.tsx`: 옵션 제출 → `generateExamSet`(진행상황 콜백 연결) → (TTS 키 있으면) `synthesizeListeningAudio` → `export-hwpx` → `export-pdf` → `DownloadPanel` 노출. 각 단계 실패는 개별적으로 처리(오디오 합성 실패는 전체 파이프라인을 막지 않고 MP3만 건너뛰며 사유를 안내, HWPX/PDF 실패는 전체 에러로 표시)

**브라우저 검증**: 이 세션 환경은 실제 Gemini/TTS 키가 없고 `netlify dev`(Functions 로컬 실행)도 설정돼 있지 않아, `vite dev` + Playwright(헤드리스 Chromium, `/opt/pw-browsers` 사전 설치본 사용)로 클라이언트 쪽 동작만 실제로 확인했다: API 키 미설정 시 설정 화면 유도 → 가짜 Gemini 키 저장 후 메인 화면 전환 → 옵션 폼 기본값 정상 표시 → 생성 시작 시 진행상황 컴포넌트가 올바른 스텝 목록(TTS 키 없어 "음성 합성" 단계 제외)으로 뜨고 1단계가 활성 표시됨 → 실제 Gemini 호출이 (샌드박스 네트워크 제약으로) 3회 재시도 후 실패하며 에러 메시지가 정상 표시되고 폼이 다시 제출 가능한 상태로 복귀. TTS/오디오 병합/HWPX/PDF 서버리스 함수 자체는 각각 Phase 4~6에서 CLI 스크립트로 이미 개별 검증됐고, 이번에 추가한 `apiClient.ts`/`audioOrchestration.ts`는 그 API 계약을 그대로 따르는 얇은 래퍼라 별도 스모크 테스트 없이 코드 리뷰로 대조 확인함.

## 폴더 구조 (목표)

```
src/
├── components/        # ApiKeySettings, ExamOptionsForm, GenerationProgress, DownloadPanel
├── lib/
│   ├── apiKeyStorage.ts  # localStorage 기반 Gemini/TTS 키 read/write
│   ├── gemini.ts       # Gemini 호출(사용자 apiKey 인자) + JSON 파싱/검증 + onProgress 콜백
│   ├── apiClient.ts    # 브라우저 → Netlify Functions fetch 래퍼(generate-audio-background/get-audio-clips/merge-audio-background/get-merged-audio/export-hwpx/export-pdf)
│   ├── audioOrchestration.ts  # synthesizeListeningAudio — TTS 요청+폴링+병합 플랜+병합 트리거+폴링을 한 번에 처리
│   ├── resolveTemplateDir.ts  # (Node 전용) templates/ 디렉터리를 여러 후보 경로 중에서 실제 존재하는 곳으로 방어적으로 찾음(hwpx/pdf paths.ts가 공용으로 사용)
│   ├── prompts/        # listeningPrompt.ts, readingPrompt.ts
│   ├── types.ts        # ExamSet 등 타입 정의
│   ├── hwpx/           # (Node 전용, 브라우저 번들 제외) HWPX 조립 — paths/textUtils/listeningFragment/listeningSection/readingSection/readingStyleConfig/buildHwpx
│   ├── tts/            # (Node 전용) Google Cloud TTS 호출 — voices/googleTts/types
│   ├── audio/          # 오디오 병합 로직 — types/timing/buildMergePlan(브라우저에서도 재사용되는 순수 로직)/ffmpegMerge(Node 전용, ffmpeg-static 미의존, 경로는 호출자가 주입)
│   └── pdf/            # (Node 전용) PDF 렌더러 — fonts/layout/blocks/buildPdf/components(react-pdf)
├── App.tsx / main.tsx  # 옵션 선택 → Gemini → (TTS 키 있으면) 음성합성/병합 → HWPX → PDF → 다운로드 파이프라인 전체 연결
scripts/                # test-gemini.ts, hwpx-poc.ts, hwpx-listening-poc.ts, hwpx-reading-poc.ts, hwpx-full-exam-poc.ts, pdf-full-exam-poc.ts, test-tts.ts, test-merge-audio.ts, fixtures/sampleExamSet.ts (개발용 Node CLI 테스트)
netlify/functions/      # generate-audio-background·get-audio-clips·merge-audio-background·get-merged-audio·export-pdf·export-hwpx(전부 완료) (TTS 키는 요청 시점 일회성 전달)
templates/
├── hwpx-template/      # 고등부.hwpx 압축 해제본 원본 + fragments/(파라미터화된 문항 조각 템플릿)
└── pdf-template/       # fonts/(NotoSansKR-Regular.otf, NotoSansKR-Bold.otf — 한글+라틴 서브셋)
docs/                   # 원본 설계 문서 2건 보관
netlify.toml            # functions 디렉터리 + SPA fallback redirect
```

## 배포 시 유의사항

- SSR 불필요 — 순수 SPA + Netlify Functions 구조 유지
- ffmpeg 바이너리는 서버리스 함수 배포 용량 제한(보통 50MB) 고려, 초과 시 별도 서비스 분리 검토
- HWPX 출력 파일명은 ASCII만 사용(한글 파일명 다운로드 시 깨짐 이력 있음), 표시명만 한글
- ⚠️ **`templates/` 자산은 `netlify.toml`의 `[functions."함수명"].included_files`로 명시해야 함** — Netlify Functions 번들러는 정적 import된 JS/TS만 자동 포함하고 `templates/hwpx-template/`(XML)·`templates/pdf-template/`(폰트) 같은 비-코드 자산은 포함하지 않는다. 실제 배포에서 `export-hwpx`가 `ENOENT: stat '/var/task/templates/hwpx-template/Contents/section0.xml'`(502 Bad Gateway)로 실패해 발견·수정함(`export-pdf`도 동일 구조라 선제적으로 함께 반영). 새로 추가하는 함수가 `templates/` 아래 파일을 `fs`로 직접 읽는다면 이 설정도 함께 추가해야 함
  - `included_files`만으로 해결이 안 될 가능성(번들러가 파일을 배치하는 실제 상대 위치가 `process.cwd()` 기준과 다를 수 있음)에 대비해, `src/lib/resolveTemplateDir.ts`가 `process.cwd()`·함수 파일 자신의 위치·그 상위 디렉터리들을 순서대로 시도해 실제로 존재하는 경로를 채택하도록 방어적으로 구현(`hwpx/paths.ts`, `pdf/paths.ts`가 사용). 그래도 못 찾으면 시도한 모든 경로를 나열한 에러를 던짐
  - **배포 후 파일이 실제로 포함됐는지 확인하는 방법**: `export-hwpx.ts`/`export-pdf.ts`는 콜드 스타트 시 `console.log`로 `cwd`/`LAMBDA_TASK_ROOT`/`HWPX_TEMPLATE_DIR`/`FONT_REGULAR_PATH` 등 실제 경로와 `existsSync` 결과를 찍는다 → Netlify 대시보드 → 해당 사이트 → **Functions** 탭 → `export-hwpx`(또는 `export-pdf`) 클릭 → **Logs**에서 확인. `exists=false`면 `included_files` 설정 자체나 배포 캐시 문제이니 "Clear cache and deploy site"로 재배포 시도
- ⚠️ **`import.meta.url`을 Netlify Functions 코드에서 쓰면 안 된다**: Netlify는 함수를 esbuild로 CJS로 번들링하는데, esbuild는 CJS 출력에서 `import.meta`를 빈 객체로 치환한다 — 그 결과 로컬(tsx, 실제 ESM 실행)에서는 정상 동작하던 `import.meta.url`이 Netlify 배포 환경에서는 `undefined`가 되고, 이 값을 `fileURLToPath`나 `createRequire`에 넘기면 `TypeError [ERR_INVALID_ARG_TYPE]: The "path"/"filename" argument must be of type string or an instance of URL. Received undefined`가 발생한다. 실제로 `export-hwpx`/`export-pdf`가 이 에러로 502를 낸 것을 발견해 `resolveTemplateDir.ts`가 `import.meta.url` 파싱 실패 시 크래시하지 않고 `process.cwd()`/`LAMBDA_TASK_ROOT`(AWS Lambda가 항상 주입하는 함수 코드 루트, 보통 `/var/task`) 기반 후보로 폴백하도록 수정했다. `merge-audio-background.ts`의 `resolveFfmpegPath`(ffmpeg-static 경로 탐색용 `createRequire(import.meta.url)`)도 같은 문제가 잠재해 있어 `createRequire(path.join(process.cwd(), 'index.js'))`로 앵커를 바꿔 선제적으로 함께 수정. **새로 작성하는 Netlify Function이나 그 안에서 호출하는 Node 전용 모듈에서는 `import.meta.url`/`__dirname` 대신 `process.cwd()`나 `LAMBDA_TASK_ROOT`를 쓰는 편이 안전하다.**
- 서버리스 함수 호출 실패 시 `src/lib/apiClient.ts`가 HTTP 상태 코드 + 응답 본문 일부를 에러 메시지에 그대로 포함하도록 되어 있음(Netlify 자체 에러 페이지 등 JSON이 아닌 응답도 원인 파악 가능하도록) — 그래도 원인이 불명확하면 Netlify 대시보드 → 해당 사이트 → **Functions** 탭 → 함수 이름 클릭 → **Logs**에서 실제 실행 로그 확인(또는 Deploys → 특정 배포 → Functions 로그)
- ⚠️ **TTS 클립 생성도 Background Function이다**: `generate-audio-background.ts` + `get-audio-clips.ts`(위 "오디오 병합 모듈" 절 참고) — 예전 동기 함수 버전은 문항이 많으면 504 Timeout이 났음
