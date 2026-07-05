# Dev-mode Vite Plugin + Claude Skill Design (monorepo edition)

- 날짜: 2026-07-05
- 대상: pnpm + turborepo 모노레포 전환 · 신규 `@agentic-prd/dev-plugin` · 짝을 이루는 Claude Code skill

## 목표

위젯이 캡처해 저장한 코멘트·기획문서를 개발 시점에 로컬 워크스페이스 안에서 열람·정리한다. 위젯과 dev-plugin 을 pnpm workspaces + turborepo 로 나눠, dev-plugin 은 Vite dev 서버 안에서 미들웨어로만 동작하는 사이드카 형태로 둔다(별도 프로세스 없음). Claude Code skill 은 이 로컬 Vite dev 서버로 curl 을 쳐 개발 세션 안에서 자연어 명령으로 조회·정리한다.

## 모노레포 레이아웃

```
agentic-prd/
├─ package.json              # workspace root, "private": true
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json        # 공용 컴파일러 옵션
├─ biome.json                # 공용 lint/format
├─ .gitignore
├─ apps/
│  └─ playground/            # 이전 root/playground/
│     ├─ package.json        # "private": true, deps: @agentic-prd/widget, @agentic-prd/dev-plugin
│     ├─ vite.config.ts
│     └─ src/…
├─ packages/
│  ├─ widget/                # 이전 root/src/
│  │  ├─ package.json        # "name": "@agentic-prd/widget"
│  │  ├─ tsconfig.json       # extends tsconfig.base.json
│  │  ├─ tsdown.config.ts
│  │  └─ src/…               # CommentWidget, anchor, canvas, components, hooks, specs, store …
│  └─ dev-plugin/            # NEW
│     ├─ package.json        # "name": "@agentic-prd/dev-plugin"
│     ├─ tsconfig.json       # extends tsconfig.base.json
│     ├─ tsdown.config.ts    # platform: "node"
│     └─ src/
│        ├─ index.ts         # export default agenticPRDDev(options)
│        ├─ plugin.ts        # Vite Plugin object (configureServer)
│        ├─ router.ts        # method/path → handler
│        ├─ handlers/
│        │  ├─ threads.ts    # list, get, resolve, unresolve, location
│        │  └─ specs.ts      # list, get, sync-one, sync-all
│        ├─ supabase.ts      # server-side @supabase/supabase-js 클라이언트
│        ├─ anchor-resolver.ts
│        ├─ slug.ts
│        ├─ manifest.ts
│        └─ types.ts
├─ plugins/
│  └─ agentic-prd-skill/     # Claude Code skill (npm 패키지 아님)
│     ├─ plugin.json
│     ├─ skills/agentic-prd.md
│     └─ commands/…
└─ docs/
```

## 패키지 & 이름

| 워크스페이스 | 이름 | 배포 | 용도 |
|---|---|---|---|
| `packages/widget` | `@agentic-prd/widget` | npm public | 위젯 라이브러리 |
| `packages/dev-plugin` | `@agentic-prd/dev-plugin` | npm public | Vite 플러그인 사이드카 |
| `apps/playground` | `agentic-prd-playground` | private | 개발용 데모 |
| `plugins/agentic-prd-skill` | (npm 아님) | 심볼릭 링크 or 복사 | Claude Code skill |

**Breaking**: 기존 root 의 `agentic-prd` 이름은 `@agentic-prd/widget` 으로 이동한다. 현재 버전이 `0.0.0` 이라 외부 소비자 없음 → 리네이밍 안전.

## 모노레포 도구 구성

### `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    },
    "play": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### root `package.json` (scripts)
```json
{
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "play": "turbo run play --filter agentic-prd-playground"
  }
}
```

## 진입점 & 사용법

```ts
// apps/playground/vite.config.ts
import agenticPRDDev from "@agentic-prd/dev-plugin";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    agenticPRDDev({
      storage: { url, publicKey },        // 위젯 config 와 동일
      specSyncDir: "docs/specs",           // 워크스페이스 루트 기준 상대 경로
      projectRoot: process.cwd(),          // anchor grep 루트(기본: 워크스페이스 루트)
    }),
  ],
});
```

`agenticPRDDev(options)` 는 표준 Vite Plugin 오브젝트를 반환한다. 별도 프로세스 없음, dev 서버 라이프사이클 공유.

## Discovery 파일

Vite dev 서버 부팅 시 플러그인이 다음 파일을 씀:

```jsonc
// <workspaceRoot>/.agentic-prd.dev.json
{ "port": 5174, "prefix": "/__agentic-prd" }
```

- 위치는 워크스페이스 루트 (pnpm-workspace.yaml 이 있는 디렉터리). 플러그인이 `process.cwd()` 부터 `pnpm-workspace.yaml` 을 찾아 올라간다. 없으면 `process.cwd()` 로 fallback.
- Skill 도 같은 방식으로 이 파일을 찾는다.
- 프로세스 종료 훅으로 파일 자동 삭제. `.gitignore` 대상.

## HTTP 엔드포인트 (프리픽스 `/__agentic-prd/`)

모두 JSON. `127.0.0.1` / `::1` 만 통과.

| Method + Path | 요청 | 응답 |
|---|---|---|
| `GET /threads` | `?path=&resolved=&limit=` | `Thread[]` |
| `GET /threads/:id` | — | `Thread` (comments 포함) |
| `GET /threads/:id/location` | — | `{ candidates: LocationCandidate[] }` |
| `POST /threads/:id/resolve` | — | `Thread` (`resolved: true`) |
| `POST /threads/:id/unresolve` | — | `Thread` (`resolved: false`) |
| `GET /specs` | `?path=` | `Spec[]` |
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
  file: string;         // 워크스페이스 루트 기준 상대 경로
  line: number;         // 1-based
  evidence: string;     // 예: 'data-testid="row-11"'
  kind: "reactSource" | "testid" | "id-attr" | "reactPath";
  confidence: number;   // 0..1
}
interface Spec {
  id: string;
  path: string;
  title: string;
  status: "DRAFT" | "REVIEW" | "CONFIRMED";
  body: string;
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

`GET /threads/:id/location` 은 anchor 를 워크스페이스 안 소스에서 검색해 파일:라인 후보를 최대 5 개 반환.

**우선순위**
1. `anchor.reactSource.fileName` 존재 → 그대로 반환 (`kind: "reactSource"`, `confidence: 1`).
2. `anchor.selector` 파싱 → `data-testid`, `data-test`, `id` 속성 값 grep (`kind: "testid" | "id-attr"`, `confidence: 0.8`).
3. `anchor.reactPath` leaf-most 부터 컴포넌트 정의 grep. 정규식:
   - `export (?:default )?function <Name>\(`
   - `function <Name>\(`
   - `const <Name>\s*=\s*(?:memo\(|forwardRef\(|\()`
   `kind: "reactPath"`, `confidence: 0.5`.

**검색 도구**: `ripgrep` 우선, 없으면 fs walk + 정규식 fallback.

**검색 대상**: 워크스페이스 루트 하위 `*.{ts,tsx,js,jsx}`. 제외: `node_modules`, `dist`, `.turbo`, `.git`, `docs`, `.next`, `.vite`, `plugins/`.

후보 0 개면 `200 { candidates: [] }` (실패 아님).

## Spec sync

### 파일명 규칙

- Title → slug: kebab-case, 라틴 알파뉴메릭 + 한글/일본어/중국어 유지 (URL-safe UTF-8), 공백 → `-`, 연속 `-` 축약.
- 기본 `<slug>.md`
- Collision (같은 slug 를 갖는 spec 이 같은 `specSyncDir` 안에 여러 개): 그 그룹 **전원** `<slug>-<idShort>.md` (idShort = UUID 앞 8자).

### `POST /specs/sync?path=`

1. path 지정 시 그 path 의 specs, 미지정 시 전체.
2. 각 spec 의 slug 계산 → `Map<slug, spec[]>` 그룹화.
3. 그룹 크기별 파일명 결정 (위 규칙).
4. `<specSyncDir>/` 없으면 mkdir.
5. Manifest (`<specSyncDir>/.sync.json`) 로드 → 각 spec 파일 write → manifest 업데이트.
6. Manifest 에 있었지만 이번 결과에 없는 파일(spec 삭제 또는 collision 규칙으로 이름 변경) 은 fs 에서 삭제 → `removed` 배열 반환.

### `POST /specs/:id/sync`

같은 path 의 sibling specs 조회 후 collision 판정 → 위와 동일한 규칙 적용. 반환값 `collided` 필드로 표시.

### 파일 헤더

```markdown
<!-- agentic-prd:spec id=<id> updatedAt=<iso> status=<STATUS> -->

# <Title>

<body>
```

로컬 파일이 어떤 spec 에서 왔는지 식별. v2 의 push-back 기능 기반.

## 인증 & 보안

- 미들웨어 첫 줄에서 `req.socket.remoteAddress` 가 `127.0.0.1` 또는 `::1` 이 아니면 `403`.
- Supabase publicKey (anon) 만 지원. Service role 안 받음. RLS 는 호스트 앱과 동일 정책.
- Vite `configureServer` 훅으로 dev 전용. `build` 아웃풋 무영향.
- `.agentic-prd.dev.json` 은 `.gitignore` 대상 (port + prefix 만 담지만 관례).

## Claude Code Skill

`plugins/agentic-prd-skill/`. Claude Code plugin manifest 규격.

```
plugins/agentic-prd-skill/
├─ plugin.json
├─ skills/agentic-prd.md         # 자연어 진입 설명
└─ commands/
   ├─ list-threads.md
   ├─ thread.md                  # id 주면 상세 + location 병렬
   ├─ resolve.md
   ├─ unresolve.md
   └─ sync-specs.md
```

**동작 순서**
1. cwd → 상위로 `pnpm-workspace.yaml` 찾음 → 같은 디렉터리에서 `.agentic-prd.dev.json` 읽음.
2. 자연어 명령 매핑:
   - "open threads / unresolved threads" → `GET /threads?resolved=false`
   - "thread {id}" → `GET /threads/:id` + `GET /threads/:id/location` 병렬
   - "resolve thread {id}" → `POST /threads/:id/resolve`
   - "unresolve thread {id}" → `POST /threads/:id/unresolve`
   - "sync specs [path]" → `POST /specs/sync?path=…`
3. `curl` / `bash` 로 호출, 응답을 요약 리턴.
4. Discovery 파일 없으면 안내: "먼저 `pnpm play` 로 dev 서버를 켜세요."

**배포**: 사용자가 이 저장소를 clone 하면 `plugins/agentic-prd-skill` 을 `~/.claude/plugins/` 로 심링크 하거나 복사. README 로 문서화.

## 데이터 흐름

```
Claude Code (skill)
  ↓  curl http://localhost:5174/__agentic-prd/threads
Vite dev server (@agentic-prd/dev-plugin middleware)
  ↓  fetch via @supabase/supabase-js
Supabase (demo_comments / demo_specs)
```

Spec sync:
```
skill → POST /specs/sync
  ↓  plugin lists specs → group by slug → resolve collisions
  ↓  fs.writeFile(<specSyncDir>/<slug>[-<idShort>].md)
  ↓  update <specSyncDir>/.sync.json
  → 200 { synced, removed }
```

## 에러 처리

- 미들웨어 최상단 try/catch → `500 { error: "internal", message, stack }` (dev 이므로 stack 포함).
- Supabase 조회 실패 → `502 { error: "supabase", detail }`.
- 존재하지 않는 :id → `404 { error: "not-found", resource, id }`.
- 프리픽스 이후 매칭 실패 → `next()` 로 넘김 (Vite 기본 처리).
- Sync 대상 디렉터리 mkdir 실패 → `500`.
- Location 리졸버 후보 0 개 → `200 { candidates: [] }`.

## 테스트 전략

- **단위**: `slug.ts`, `anchor-resolver.ts`, `manifest.ts` → vitest.
- **핸들러 통합**: 각 handler 를 mock Supabase 클라이언트로 직접 호출.
- **엔드-투-엔드**: 실제 Vite dev 서버 부팅해서 fetch 로 응답 확인 (mock Supabase + tmp 디렉터리).
- **skill** 은 shell 스크립트 스모크만.

## 빌드 & Export 구성

### `packages/widget/package.json`
```jsonc
{
  "name": "@agentic-prd/widget",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./package.json": "./package.json"
  },
  "files": ["dist", "src"],
  "peerDependencies": { "react": "*", "react-dom": "*" }
}
```

### `packages/dev-plugin/package.json`
```jsonc
{
  "name": "@agentic-prd/dev-plugin",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./package.json": "./package.json"
  },
  "files": ["dist", "src"],
  "peerDependencies": { "vite": ">=5" },
  "dependencies": { "@supabase/supabase-js": "^2" }
}
```

### `packages/dev-plugin/tsdown.config.ts`
```ts
import { defineConfig } from "tsdown";
export default defineConfig({
  entry: ["src/index.ts"],
  platform: "node",
  external: ["vite", "@supabase/supabase-js"],
  format: ["esm"],
  dts: true,
});
```

`platform: "node"` 는 컴파일 타겟(node ESM 모듈)만 의미. **런타임은 여전히 Vite dev 서버 안**. 별도 프로세스 아님.

## 모노레포 마이그레이션 단계 (구현 태스크에서 상세화)

1. root `package.json` 을 workspace 루트로 전환 (`private: true`, 앱 스크립트만).
2. `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` 추가.
3. root `src/` → `packages/widget/src/` 이동. 자체 `package.json`, `tsconfig.json`, `tsdown.config.ts` 생성. 이름 `@agentic-prd/widget`.
4. root `playground/` → `apps/playground/`. `package.json` 에 `@agentic-prd/widget` workspace deps 선언.
5. `packages/dev-plugin/` 신규 생성 (구현).
6. Vitest / biome 은 워크스페이스 루트 설정 유지, 각 패키지가 확장.
7. `.gitignore` 에 `.turbo`, `**/dist`, `.agentic-prd.dev.json` 추가.
8. `AGENTS.md` / `CLAUDE.md` / `README` 를 신규 레이아웃에 맞춰 갱신.

## 스코프 밖 (v1)

- 코멘트 작성/수정/삭제 (읽기 + resolve/unresolve 만).
- Spec push-back (로컬 편집 → Supabase). 파일 헤더에 id 를 심는 이유는 v2 를 열어둠.
- 인증 · 다중 사용자.
- WebSocket / SSE.
- 브라우저 UI. skill/CLI 만.

## 저장 위치

이 문서: `docs/superpowers/specs/2026-07-05-dev-plugin-design.md`
