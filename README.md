# agentic-prd

[English](#english) | [한국어](#한국어)

## English

Pin comments on your running app, let a coding agent fix exactly that spot.

**For vibe-coders:** click where it's wrong, write a comment, run
`/agentic-prd:work` in Claude Code — the agent finds the source behind the pin,
fixes it, replies in the thread, and resolves it.

**For teams:** PM/QA pin "this exact part is wrong" on the dev build with
per-screen spec docs attached; comments live in `.agentic-prd/*.json` — commit
the folder to share via git. No backend, no accounts.

### Quickstart (3 steps, zero-config)

```bash
npm i @agentic-prd/widget
npm i -D @agentic-prd/dev-plugin
```

```ts
// vite.config.ts
import agenticPRDDev from "@agentic-prd/dev-plugin";

export default defineConfig({
  plugins: [react(), agenticPRDDev()],
});
```

```tsx
// your app root
import { CommentWidget } from "@agentic-prd/widget";

<CommentWidget pageKey={location.pathname} />
```

Tailwind v4 host — add to your CSS entry (adjust the relative path):

```css
@source "../node_modules/@agentic-prd/widget/src";
```

Claude Code skill:

```
/plugin marketplace add CreeJee/agentic-prd
/plugin install agentic-prd@agentic-prd
```

Or let Claude do all of the above in your app: `/agentic-prd:setup`.

Other install options:

- `npx skills add CreeJee/agentic-prd` — one-click, skill only (no slash commands).
- Paste into any coding agent: *"Read
  https://raw.githubusercontent.com/CreeJee/agentic-prd/main/llms-install.md
  and follow it."*
- From a clone of this repo: `pnpm skill:install` (flags: `--copy`, `--force`,
  `--dest <dir>`).

### The loop

1. Run your dev server; the toolbar appears. Set your name, pin comments.
2. `/agentic-prd:list-threads` — see open feedback.
3. `/agentic-prd:work` — the agent locates each pin's source, fixes it,
   replies in-thread, resolves. You see the replies in the widget.
4. `/agentic-prd:sync-specs` — pull per-screen spec docs into `docs/specs/`.

### Packages

| Package | What |
| --- | --- |
| [`@agentic-prd/widget`](packages/widget) | React comment-pin + spec-doc overlay |
| [`@agentic-prd/dev-plugin`](packages/dev-plugin) | Vite dev sidecar: local JSON storage + HTTP API for agents |
| [`plugins/agentic-prd-skill`](plugins/agentic-prd-skill) | Claude Code plugin (setup / work / list / resolve / sync) |

Storage is pluggable (`StorageAdapter`) — the local dev server is the default;
a hosted backend can implement the same interface later.

### Developing this repo

pnpm + turborepo. Node ≥ 20.19 (repo pins Node 26 via `.node-version` /
`mise.toml` — `mise install` or `fnm use` picks it up). `pnpm install`, then:

```bash
pnpm play        # demo commerce app (apps/playground) with the widget mounted
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

See `AGENTS.md` for architecture and conventions, and
[`llms-install.md`](llms-install.md) for the machine-followable install guide.

---

## 한국어

실행 중인 앱 위에 코멘트 핀을 찍으면, 코딩 에이전트가 정확히 그 지점을 고칩니다.

**바이브 코더라면:** 잘못된 곳을 클릭해 코멘트를 남기고 Claude Code에서
`/agentic-prd:work` 실행 — 에이전트가 핀 뒤의 소스를 찾아 고치고, 스레드에
답글을 달고, resolve까지 합니다.

**팀이라면:** PM/QA가 dev 빌드 위에 "정확히 이 부분이 잘못됐다"를 화면별
기획문서와 함께 핀으로 남깁니다. 코멘트는 `.agentic-prd/*.json`에 저장되므로
폴더를 커밋하면 git으로 공유됩니다. 백엔드도 계정도 없습니다.

### 빠른 시작 (3단계, 설정 없음)

```bash
npm i @agentic-prd/widget
npm i -D @agentic-prd/dev-plugin
```

```ts
// vite.config.ts
import agenticPRDDev from "@agentic-prd/dev-plugin";

export default defineConfig({
  plugins: [react(), agenticPRDDev()],
});
```

```tsx
// 앱 루트
import { CommentWidget } from "@agentic-prd/widget";

<CommentWidget pageKey={location.pathname} />
```

Tailwind v4 호스트 — CSS 엔트리에 추가 (상대 경로는 맞춰서):

```css
@source "../node_modules/@agentic-prd/widget/src";
```

Claude Code skill:

```
/plugin marketplace add CreeJee/agentic-prd
/plugin install agentic-prd@agentic-prd
```

또는 위 과정 전부를 Claude에게 맡기세요: `/agentic-prd:setup`.

다른 설치 방법:

- `npx skills add CreeJee/agentic-prd` — 원클릭, skill만 (슬래시 커맨드 제외).
- 아무 코딩 에이전트에나 붙여넣기: *"https://raw.githubusercontent.com/CreeJee/agentic-prd/main/llms-install.md
  를 읽고 그대로 따라해줘."*
- 이 레포 클론에서: `pnpm skill:install` (플래그: `--copy`, `--force`,
  `--dest <dir>`).

### 루프

1. dev 서버를 켜면 툴바가 나타납니다. 이름을 설정하고 코멘트 핀을 찍으세요.
2. `/agentic-prd:list-threads` — 열린 피드백 확인.
3. `/agentic-prd:work` — 에이전트가 핀마다 소스를 찾아 고치고, 스레드에
   답글을 달고, resolve합니다. 답글은 위젯에서 바로 보입니다.
4. `/agentic-prd:sync-specs` — 화면별 기획문서를 `docs/specs/`로 내려받기.

### 패키지

| 패키지 | 설명 |
| --- | --- |
| [`@agentic-prd/widget`](packages/widget) | React 코멘트 핀 + 기획문서 오버레이 |
| [`@agentic-prd/dev-plugin`](packages/dev-plugin) | Vite dev 사이드카: 로컬 JSON 저장소 + 에이전트용 HTTP API |
| [`plugins/agentic-prd-skill`](plugins/agentic-prd-skill) | Claude Code 플러그인 (setup / work / list / resolve / sync) |

저장소는 교체 가능합니다(`StorageAdapter`) — 기본값은 로컬 dev 서버이고,
호스팅 백엔드는 같은 인터페이스로 나중에 붙일 수 있습니다.

### 이 레포 개발하기

pnpm + turborepo. Node ≥ 20.19 (레포는 `.node-version` / `mise.toml`로 Node 26
고정 — `mise install` 또는 `fnm use`가 자동 인식). `pnpm install` 후:

```bash
pnpm play        # 위젯이 붙어 있는 데모 커머스 앱 (apps/playground)
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

아키텍처와 컨벤션은 `AGENTS.md`, 기계가 따라할 수 있는 설치 가이드는
[`llms-install.md`](llms-install.md) 참고.
