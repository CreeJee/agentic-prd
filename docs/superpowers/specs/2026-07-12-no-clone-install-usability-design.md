# No-clone 설치 사용성 설계 (Supabase 제거 + 로컬 스토리지 + 마켓플레이스 + setup/work skill)

날짜: 2026-07-12
상태: 승인 대기

## 대상 유저

1. **바이브 코딩하는 비개발자** — 화면에 핀을 찍으면 LLM 이 정확한 지점을 찾아 고쳐주길 원한다.
   Supabase 계정·SQL·env 배선은 설치 포기 지점. vite.config 을 직접 못 만지므로 설치도 Claude 가 대행해야 한다.
2. **개발팀 + PM/PO/QA 이해관계자** — "정확히 이 부분이 잘못됐다" 를 코멘트로 남기고,
   개발자(또는 에이전트)가 처리 결과를 스레드에서 확인하길 원한다.

## 문제

- `@agentic-prd/widget` / `@agentic-prd/dev-plugin` 은 npm 미배포(404), 버전 0.0.0, README 없음.
- Claude Code skill 설치 경로가 "repo clone 후 `~/.claude/plugins` symlink" 뿐 — no-clone 유저 불가.
- dev-plugin 디스커버리가 `pnpm-workspace.yaml` 을 전제 — npm/yarn 단일 앱에서 불안정.
- **Supabase 강결합** — 로컬 도구에 외부 백엔드 의존은 설치 마찰의 대부분이고, 미래 유료 클라우드
  (도메인 분리·조직 요금제)에도 anon-key 직결 구조는 맞지 않는다. → **이번에 완전 제거한다.**
- 루트 README 부재.

## 목표 시나리오

**설치 (zero-config, 3단계):**

```bash
npm i @agentic-prd/widget && npm i -D @agentic-prd/dev-plugin   # 1. 패키지
# 2. vite.config 에 agenticPRDDev() 1줄 + 앱에 <CommentWidget /> 1개  ← storage 설정 없음
# 3. /plugin marketplace add CreeJee/agentic-prd && /plugin install agentic-prd@agentic-prd
```

또는 설치 전체를 `/agentic-prd:setup` 으로 Claude 가 대행.

**사용 루프 (비개발자 핵심 UX):** 화면에 핀 찍기 → `/agentic-prd:work` → 에이전트가 열린 스레드를
순회하며 위치확인 → 수정 → 검증 → **스레드에 답글**("수정했습니다") → resolve. 위젯에서 결과가 보인다.

**데이터:** 앱 루트 `.agentic-prd/` JSON 파일. git 커밋하면 백엔드 없이 팀 공유.
진짜 원격 협업(배포 프리뷰 상시 코멘트, 도메인/조직 단위)은 미래 유료 `cloudStorage` 의 영역 —
어댑터 경계가 그 자리를 비워둔다.

## 결정 사항 (유저 확정)

1. npm 은 **배포 준비까지** — publish 는 유저가 나중에. 검증은 `pnpm pack` 타르볼.
2. skill 배포는 **GitHub 마켓플레이스** — repo 자체가 마켓플레이스.
3. **Supabase 완전 제거** — widget·dev-plugin·supabase/ 디렉터리·e2e 인프라에서 삭제.
   AGENTS.md 의 "supabase-only" 원칙을 "storage adapter + 로컬 기본" 으로 교체.
4. **원샷 setup skill** + **드레인 루프 `/agentic-prd:work`** + **에이전트 답글(reply-back)** 포함.
5. `cloudStorage`·SQLite 는 후속 (비범위). LAN 공유 모드(allowRemote)는 유즈케이스로 채택하지 않음 —
   원격 이해관계자 협업은 배포 프리뷰(Vercel 등) + 미래 `cloudStorage` 의 영역.

## 설계

### 0. 스토리지: dev-plugin 로컬 JSON 이 단일 원천

**dev-plugin (서버):**

- `.agentic-prd/comments.json` · `.agentic-prd/specs.json` 에 저장. 쓰기는 tmp+rename 원자적 저장.
  루트 결정은 §2 디스커버리와 동일 규칙.
- 라우터에 쓰기 엔드포인트 추가 (localhost 가드 동일 적용):
  - `POST {prefix}/threads` — 스레드 생성 (위젯 insertThread)
  - `PATCH {prefix}/threads/:id` — 앵커/좌표/comments/resolved 패치 (위젯 patchThread)
  - `POST {prefix}/threads/:id/comments` — 댓글 append (위젯 답글 + **에이전트 reply-back** 공용)
  - `PUT {prefix}/specs/:id` — 스펙 upsert (SpecPanel 자동저장)
- 기존 읽기/resolve/sync 엔드포인트와 응답 shape 는 유지 — skill 계약 불변. `AgenticPRDDevOptions.storage`
  옵션은 제거(하위호환 없음 — 미배포 패키지라 소비자가 playground 뿐).
- 이 HTTP 계약이 미래 cloud API 의 초안.

**widget (클라):**

- `store.ts`/`specs` 의 Supabase 호출을 `StorageAdapter` 인터페이스 뒤로:

  ```ts
  interface StorageAdapter {
    listThreads(path): Promise<ThreadRow[]>;
    insertThread(row): Promise<ThreadRow>;
    patchThread(id, patch): Promise<ThreadRow>;
    appendComment(id, comment): Promise<ThreadRow>;
    listSpecs(path): Promise<SpecRow[]>;
    upsertSpec(row): Promise<SpecRow>;
  }
  ```

- 행 shape(id/path/x_pct/y_pct/anchor/resolved/comments/updated_at, specs 동일)는 현행 유지 —
  react-query 훅·낙관적 업데이트·폴링(4s/5s)·앵커 저장 규칙(insert·patch 양쪽) 불변.
- `config.storage` 는 optional `StorageAdapter` 로 변경. **미지정 = `devServerStorage()`**:
  같은 origin 의 dev-plugin 미들웨어로 상대경로 fetch (`/__agentic-prd/...`, prefix 옵션화).
  엔드포인트 부재/실패 시 콘솔 경고 1회 + 빈 상태 (프로덕션 빌드 혼입 대비, throw 금지).
- 제거: `@supabase/supabase-js` dep, `supabase.ts`, `database.types.ts`, WidgetProvider 의
  SupabaseClient 생성. 행 타입은 `types.ts` 로 손수 정의.

**playground / e2e:**

- `supabaseEnv.ts`·`VITE_SUPABASE_*` 제거, vite config 은 `agenticPRDDev({ specSyncDir: "docs/specs" })`.
- e2e: `local-supabase.ts` 삭제, global-setup 의 truncate → `.agentic-prd/` 삭제 + PRD 시드는
  dev-plugin HTTP(PUT specs)로. seed-comments.spec(실 위젯 UI 시드)은 그대로 동작해야 함.
- `supabase/` 디렉터리(config.toml·migrations) 삭제.

### 1. npm 배포 준비 (`packages/widget`, `packages/dev-plugin`)

- 버전 `0.1.0`, `repository`(directory)/`homepage`/`keywords`/`author` 메타데이터.
- 패키지별 `README.md` 작성, `files` 포함 (npm 페이지 = 1차 문서).
- `pnpm pack` 산출물 검증: publishConfig exports 와 실제 dist 파일명 일치
  (dev-plugin `dist/index.mjs` vs `dist/index.js` 불일치 의심 — tsdown 산출물 기준 정리).
- publish 는 안 한다. owner 용 배포 절차만 README 에 짧게.

### 2. 디스커버리 일반화 (dev-plugin)

- `.agentic-prd.dev.json` 과 `.agentic-prd/` 데이터 폴더의 루트: **pnpm-workspace.yaml 이 있으면
  workspace 루트(모노레포 호환), 없으면 Vite `server.config.root`** (process.cwd 폴백 제거).
- `projectRoot`/`specSyncDir` 상대경로 해석도 동일 루트 기준.
- SKILL.md: "pnpm-workspace.yaml 탐색" → "cwd 에서 위로 `.agentic-prd.dev.json` 자체를 탐색".
  부재 에러 문구는 "호스트 앱 dev 서버(`npm run dev` 등, 이 repo 는 `pnpm play`) 기동" 으로 일반화.

### 3. GitHub 마켓플레이스 + 플러그인 표준 레이아웃

- repo 루트 `.claude-plugin/marketplace.json`:
  `{ "name": "agentic-prd", "owner": {...}, "plugins": [{ "name": "agentic-prd", "source": "./plugins/agentic-prd-skill", "description": ... }] }`
- 플러그인 재배치: `plugin.json` → `.claude-plugin/plugin.json`, `skills/agentic-prd.md` →
  `skills/agentic-prd/SKILL.md`, 신규 `skills/setup/SKILL.md`. `commands/*.md` 플랫 유지.
- plugin.json `name` = 마켓플레이스 엔트리 `name` ("agentic-prd"). 버전은 plugin.json 에만.
- push 전 검증: `claude plugin validate .` + `/plugin marketplace add <로컬경로>` 설치 리허설.

### 4. skill 확장

**`/agentic-prd:setup` (원샷 설치, 신규 SKILL.md):**

1. 앱 감지 — vite config + 패키지 매니저(lockfile). Vite 앱 아니면 중단·안내.
2. `@agentic-prd/widget`(dep) + `@agentic-prd/dev-plugin`(devDep) 설치.
3. vite.config 에 `agenticPRDDev()` 배선 (옵션 불필요).
4. 앱 루트에 `<CommentWidget pageKey={...}/>` 삽입 (라우터 있으면 pathname, 없으면 생략 —
   browserRouteSource 폴백).
5. Tailwind v4 감지 시 CSS entry 에 `@source "../node_modules/@agentic-prd/widget/src"`
   (CSS 파일 위치 기준 경로 계산). 미사용 앱이면 위젯 스타일에 호스트 Tailwind 필요 안내.
6. `.agentic-prd/` git 취급 질문(커밋=팀 공유 / ignore=개인) 후 반영.
7. 검증 — dev 서버 기동 → 디스커버리 파일 + `GET {base}/threads` 200 + POST→GET 왕복 +
   typecheck/빌드. 실패 시 수정 후 재검증, 통과까지 반복. 요약 보고.

**`/agentic-prd:work` (드레인 루프, 신규 command):**

- 열린 스레드 목록 → 각 스레드: location candidates 로 소스 위치 확인(번들/node_modules
  false-positive 제외 규칙은 기존 SKILL.md caveat 재사용) → 수정 → 프로젝트 검증(typecheck 등) →
  `POST /threads/:id/comments` 로 **답글**("무엇을 어떻게 고쳤는지 1-2문장") → resolve.
- 위치를 못 찾거나 수정이 모호하면 그 스레드는 건너뛰고 답글로 질문을 남긴다 (resolve 안 함).
- 전체 결과 표(처리/건너뜀/사유)로 마무리.

**기존 명령** (`list-threads`/`thread`/`resolve`/`unresolve`/`sync-specs`) 은 HTTP 계약 불변이라 유지.

### 5. 문서

- 루트 `README.md`(신규): 소개(두 유저 시나리오), zero-config Quickstart(3단계), setup/work skill 사용법,
  `.agentic-prd/` git 공유 패턴, Tailwind `@source` 함정, 모노레포 개발자 섹션(pnpm play).
- `packages/widget/README.md` · `packages/dev-plugin/README.md`(신규): npm 페이지용.
- `plugins/agentic-prd-skill/README.md`: 마켓플레이스 설치로 교체.
- `AGENTS.md` 갱신: supabase-only → 로컬 스토리지+adapter 원칙, DB 섹션 → `.agentic-prd/` JSON 설명,
  구조도(marketplace.json·플러그인 레이아웃·README) 반영, supabase 관련 함정/명령 제거.

### 6. 검증 루프 ("될 때까지 반복")

1. `pnpm build` → 두 패키지 `pnpm pack` 타르볼.
2. scratchpad 에 **workspace 밖 fresh Vite React 앱**(npm) 스캐폴드 → 루트 README quickstart 를
   문자 그대로 따라 설치 (타르볼 경로만 레지스트리 대신).
3. dev 서버 기동 검증: `.agentic-prd.dev.json` 이 앱 루트에 생성 / `GET /__agentic-prd/threads` 200 /
   POST→GET 코멘트 왕복이 `.agentic-prd/comments.json` 반영 / 답글 append / 앱 빌드 통과 —
   **외부 서비스 없이** 전부 성립.
4. 위젯 실동작: 브라우저에서 핀 생성 → 코멘트 저장 → 새로고침 후 유지 확인 (실 UI 경로).
5. playground 회귀: `pnpm play` 로컬 스토리지로 동작, seed e2e 경로 갱신 후 통과, typecheck·biome 0.
6. `claude plugin validate .` + 로컬 marketplace add → install 리허설 → skill/commands 로드 확인.
7. 실패 항목 수정 → 1부터 재실행. 전 항목 green 까지 반복, 결과를 검증 리포트로 기록.

### 비범위 (YAGNI)

- 실제 `npm publish` (유저 몫).
- `cloudStorage`·멀티테넌시·과금 (어댑터/HTTP 계약이 마이그레이션 경로라는 것까지만).
- LAN 공유 모드(allowRemote) — 원격 협업은 배포 프리뷰(Vercel 등)+cloudStorage 로 간다.
- SQLite 등 DB 엔진, `npx init` CLI (setup skill 이 대체), 위젯 UI 기능 변경.

## 에러 처리

- devServerStorage: 실패 시 콘솔 경고 1회 + 빈 데이터, throw 로 호스트 앱을 깨지 않는다.
- 로컬 저장소: JSON 파싱 실패 시 `.bak` 백업 후 빈 저장소 재시작 + 경고 로그.
- 쓰기 엔드포인트: 존재하지 않는 스레드 404, 본문 검증 실패 400.
- setup/work skill: 단계 실패 시 원인·수동 우회 안내 후 중단/건너뜀 — 조용히 넘어가지 않는다.

## 테스트

- `pnpm typecheck` + biome error 0 유지.
- dev-plugin vitest: 로컬 저장소 CRUD·원자적 쓰기·append·루트 결정(모노레포 마커 유/무).
- widget vitest: 어댑터 해석(미지정→devServerStorage, 커스텀→그대로), devServerStorage 실패 시 빈 상태.
- 통합은 §6 검증 루프 (재현 절차를 리포트에 기록).
