# Dev-mode Vite Plugin + Claude Skill Design

- 날짜: 2026-07-05
- 대상: 새 서브패스 `agentic-prd/dev-plugin`, 짝을 이루는 Claude Code skill

## 목표

위젯이 캡처해 저장한 코멘트·기획문서를 개발 시점에 로컬 워크스페이스 안에서 열람·정리할 수 있게 한다. 개발자는 실제 코드를 편집하는 세션 안에서 자연스럽게 코멘트를 확인하고, 위치 힌트(파일:라인) 를 얻고, 스펙 문서를 로컬 마크다운으로 동기화한다.

## 구성 요소

- **Vite 플러그인** — dev 서버에 미들웨어를 부착해 로컬 HTTP API 를 노출한다. 프로덕션 번들에는 아무 것도 포함되지 않는다.
- **Claude Code skill** — 그 API 를 호출해 코멘트 목록·상세·위치·스펙 동기화를 자연어 명령으로 제공한다.

## 진입점 & 사용법

```ts
// vite.config.ts
import agenticPRDDev from "agentic-prd/dev-plugin";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    agenticPRDDev({
      storage: { url, publicKey },
      specSyncDir: "docs/specs",
      projectRoot: process.cwd(),
    }),
  ],
});
```

`storage` 는 위젯 config 와 동일 형태(anon publicKey). RLS 규칙이 호스트 앱과 동일하게 적용된다.

부팅 시 플러그인은 프로젝트 루트에 `.agentic-prd.dev.json` 을 생성한다:
```json
{ "port": 5174, "prefix": "/__agentic-prd" }
```
Claude skill 이 이 파일로 dev 서버 위치를 찾는다.

## 파일 구조

```
src/dev-plugin/
  index.ts              # export default agenticPRDDev(options)
  plugin.ts             # Vite Plugin (name, configureServer)
  router.ts             # Method+path 매칭 → handler
  handlers/
    threads.ts          # list, get, resolve, unresolve, location
    specs.ts            # list, get, sync-one, sync-all
  supabase.ts           # server-side @supabase/supabase-js 클라이언트
  anchor-resolver.ts    # anchor → grep → 후보 파일:라인
  slug.ts               # title → slug, collision 판정
  manifest.ts           # <specSyncDir>/.sync.json 읽고 쓰기
  types.ts              # PluginOptions, DTO
```

skill 은 별도 위치. 이 저장소 안 `plugins/agentic-prd-skill/` 아래에 배치하고, 사용자는 자신의 `~/.claude/plugins/` 로 심볼릭 링크 걸거나 복사한다.

## HTTP 엔드포인트 (프리픽스 `/__agentic-prd/`)

모두 JSON 응답. 로컬(`127.0.0.1`) 요청만 통과.

| Method + Path | 요청 쿼리/바디 | 응답 |
|---|---|---|
| `GET /threads` | `?path=&resolved=&limit=` | `Thread[]` 요약 |
| `GET /threads/:id` | — | `Thread` (comments 포함) |
| `GET /threads/:id/location` | — | `{ candidates: LocationCandidate[] }` |
| `POST /threads/:id/resolve` | 바디 없음 | `Thread` (`resolved: true`) |
| `POST /threads/:id/unresolve` | 바디 없음 | `Thread` (`resolved: false`) |
| `GET /specs` | `?path=` | `Spec[]` 요약 |
| `GET /specs/:id` | — | `Spec` (body markdown 포함) |
| `POST /specs/sync` | `?path=` | `{ synced: SyncedSpec[], removed: string[] }` |
| `POST /specs/:id/sync` | — | `SyncedSpec` |

### DTO

```ts
interface Thread {
  id: string;
  path: string;
  resolved: boolean;
  updatedAt: number;
  comments: { id: string; author: string; text: string; at: number }[];
  anchor?: Anchor;
}
interface LocationCandidate {
  file: string;         // 프로젝트 루트 기준 상대 경로
  line: number;         // 1-based
  evidence: string;     // 예: `data-testid=\"row-11\"`
  kind: "reactSource" | "testid" | "id-attr" | "reactPath";
  confidence: number;   // 0..1
}
interface Spec {
  id: string;
  path: string;
  title: string;
  status: "DRAFT" | "REVIEW" | "CONFIRMED";
  body: string;         // markdown 전문
  externalUrl?: string;
  updatedBy: string;
  updatedAt: number;
}
interface SyncedSpec {
  id: string;
  localPath: string;    // <specSyncDir>/<slug>[.<idShort>].md
  collided: boolean;
}
```

## Anchor → 소스 위치 리졸버

`GET /threads/:id/location` 은 저장된 anchor 를 로컬 프로젝트 소스에서 검색해 파일:라인 후보를 최대 5 개 반환한다. 우선순위:

1. **`anchor.reactSource.fileName` 이 있으면** 그대로 반환 (`kind: "reactSource"`, `confidence: 1`). 프로덕션 번들이나 소스맵 세팅된 환경.
2. **`anchor.selector` 를 파싱**해 `data-testid="X"`, `data-test="X"`, `id="X"` 값을 뽑아 프로젝트 grep. 매칭 라인 각각을 후보로 (`kind: "testid"` 또는 `id-attr"`, `confidence: 0.8`).
3. **`anchor.reactPath` leaf-most 요소부터** 컴포넌트 정의 grep. 정규식:
   - `export (?:default )?function <Name>\\(`
   - `function <Name>\\(`
   - `const <Name>\\s*=\\s*(?:memo\\(|forwardRef\\(|\\()`
   `kind: "reactPath"`, `confidence: 0.5`.

검색 도구는 `ripgrep`(있으면), 없으면 fs walk + 정규식 fallback. 검색 대상은 `projectRoot` 아래 소스 확장자(`.ts`, `.tsx`, `.js`, `.jsx`) 파일만. 제외 디렉터리: `node_modules`, `dist`, `.git`, `docs`, `.turbo`, `.next`, `.vite`.

후보 없으면 `200 { candidates: [] }`. 실패로 보지 않는다.

## Spec sync

### 파일명 규칙

- Title → slug: `kebab-case`, 라틴 알파뉴메릭 + 한글/일본어/중국어 유지(URL 안전한 UTF-8), 공백 → `-`, 연속 `-` 축약.
- 기본: `<slug>.md`
- Collision (같은 slug 를 갖는 spec 이 같은 `specSyncDir` 안에 여러 개): 그 그룹의 **모든** spec 이 `<slug>-<idShort>.md`. `idShort` 는 UUID 앞 8 자.

### `POST /specs/sync?path=`

1. path 지정 시 그 path 의 specs, 미지정 시 전체 specs 조회.
2. 각 spec 의 slug 계산, `Map<slug, spec[]>` 그룹화.
3. 그룹 결정:
   - 크기 1 → `<slug>.md`
   - 크기 >1 → 그룹 내 모든 spec 은 `<slug>-<idShort>.md` (collided=true)
4. `<specSyncDir>/` 없으면 생성.
5. Manifest (`<specSyncDir>/.sync.json`) 로드. 각 spec 을 파일에 쓰고 manifest 업데이트.
6. Manifest 에 있었지만 이번 결과에 없는 이전 파일(삭제된 spec 또는 이름이 collision 규칙으로 바뀐 것) 은 fs 에서 삭제하고 `removed` 배열에 담아 반환.

### `POST /specs/:id/sync`

같은 path 의 sibling spec 들 중 slug 가 겹치면 collided 규칙 적용. 그렇지 않으면 `<slug>.md`. 반환값의 `collided` 필드로 표시.

### 파일 헤더

각 sync 파일 첫 줄:
```markdown
<!-- agentic-prd:spec id=<id> updatedAt=<iso> status=<STATUS> -->

# <Title>

<body>
```
Sync 시 이 헤더로 로컬 파일이 어떤 spec 에서 왔는지 식별한다(향후 push-back 을 위한 기반).

## 인증 & 보안

- 미들웨어 첫 줄: `req.socket.remoteAddress` 가 `127.0.0.1` 또는 `::1` 이 아니면 `403`.
- Supabase publicKey (anon key) 만 받는다. Service role 은 지원하지 않는다.
- Vite `configureServer` 훅으로 dev 전용. build 아웃풋에 영향 없음.
- `.agentic-prd.dev.json` 은 port + prefix 만 담지만 관례로 `.gitignore` 대상.

## Claude Code Skill

`plugins/agentic-prd-skill/` 아래에 배치:

```
plugins/agentic-prd-skill/
  plugin.json              # Claude Code plugin manifest
  skills/
    agentic-prd.md         # 자연어 진입점 (invocation description)
  commands/
    list-threads.md
    thread.md
    resolve.md
    unresolve.md
    sync-specs.md
```

Skill 동작:
1. 현재 작업 디렉터리에서 `.agentic-prd.dev.json` 을 찾아 dev 서버 URL 구성.
2. 자연어 → 커맨드 매핑:
   - "open threads / unresolved threads" → `GET /threads?resolved=false`
   - "thread {id}" → `GET /threads/:id` + `GET /threads/:id/location` 병렬, 결과 통합 출력 (comments + 후보 파일:라인)
   - "resolve thread {id}" → `POST /threads/:id/resolve`
   - "unresolve thread {id}" → `POST /threads/:id/unresolve`
   - "sync specs [path]" → `POST /specs/sync?path=...`
3. curl / bash 로 호출. skill 자체는 API 응답을 요약해서 리턴.

Skill 은 dev 서버가 켜져 있어야 동작. dev 서버가 없으면 안내 메시지: "먼저 `pnpm play` 로 dev 서버를 켜세요".

## 데이터 흐름

```
Claude Code
  ↓  skill runs curl http://localhost:5174/__agentic-prd/threads
Vite dev server (plugin middleware)
  ↓  fetch via @supabase/supabase-js
Supabase (demo_comments / demo_specs)
```

Spec sync 시:
```
skill → POST /specs/sync
  ↓  plugin lists specs → group by slug → resolve collisions
  ↓  fs.writeFile(<specSyncDir>/<slug>[-<idShort>].md)
  ↓  update <specSyncDir>/.sync.json manifest
  → 200 { synced, removed }
```

## 에러 처리

- 미들웨어 최상단 try/catch → 500 JSON `{ error: "internal", message, stack? }` (stack 은 dev 이므로 포함).
- Supabase 조회 실패 → 502 JSON `{ error: "supabase", detail }`.
- 존재하지 않는 :id → 404 JSON `{ error: "not-found", resource: "thread|spec", id }`.
- 잘못된 프리픽스 이후 URL → 404 (미들웨어 not matched → `next()` 로 넘김).
- Sync 대상 디렉터리 mkdir 실패 → 500.
- location 리졸버 후보 0 개 → 200 `{ candidates: [] }` (에러 아님).

## 테스트 전략

- **단위**: `slug.ts` (kebab 변환, 유니코드), `anchor-resolver.ts` (selector 파싱, grep 정규식), `manifest.ts` (읽기/쓰기, collision-driven rename).
- **핸들러 통합**: 각 handler 를 vitest 로 mock Supabase client 로 직접 호출. Express-like `req/res` shim.
- **엔드-투-엔드**: 실제 vite dev 서버를 부팅해서 fetch 로 응답 확인 (mock Supabase + 임시 tmp 디렉터리).
- **skill 은 스크립트 형태**: bash 단위 테스트 없음. dev 서버 mock 없이 직접 실행 스모크만.

## 스코프 밖 (v1 제외)

- 코멘트 작성/수정/삭제 (읽기 + resolve/unresolve 만).
- Spec push-back (로컬 편집을 Supabase 로 반영). 파일 헤더에 id 를 심는 이유는 v2 에서 이 기능을 열어두기 위함.
- 인증 · 다중 사용자.
- WebSocket / SSE (polling API 만).
- 브라우저 UI. skill/CLI 만.
- Windows 경로 대응은 되지만 CI 는 리눅스 기준.

## 빌드 & Export 구성

- `package.json` 에 `./dev-plugin` 서브패스 export 추가:
  ```json
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./dev-plugin": { "types": "./dist/dev-plugin.d.ts", "import": "./dist/dev-plugin.js" },
    "./package.json": "./package.json"
  }
  ```
- `tsdown.config.ts` 에 두 번째 entry 추가: `src/dev-plugin/index.ts`. `platform: "node"` 로, `externals: ["vite", "@supabase/supabase-js"]` 지정해 로더가 dev deps 를 번들에 포함하지 않게 한다.
- `dev-plugin` 소스는 브라우저 위젯 번들(`dist/index.js`) 에 절대 포함되지 않아야 한다. tsdown 의 entry 분리로 자연스럽게 격리됨.

## 저장 위치

이 문서: `docs/superpowers/specs/2026-07-05-dev-plugin-design.md`
