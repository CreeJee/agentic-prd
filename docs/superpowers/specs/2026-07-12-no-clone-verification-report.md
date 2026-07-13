# No-clone 설치 사용성 — 검증 리포트 (2026-07-13)

`docs/superpowers/plans/2026-07-12-no-clone-install-usability.md` Task 11 의 실행 결과.
전제: 사용자는 repo 를 clone 하지 않은 상태에서 npm 패키지 2개 + Claude Code
마켓플레이스 플러그인만으로 전체 루프를 쓸 수 있어야 한다.

## 결론

**전 항목 PASS (1차 루프에서 종료 — 원인 태스크 재수정 불필요).**
Supabase 완전 제거 후 dev-plugin 로컬 JSON 스토리지 + 위젯 `StorageAdapter`
기본값(`devServerStorage`) 구성으로, fresh Vite 앱에 타르볼 설치 → README
quickstart 그대로 → 코멘트 루프 동작까지 외부 서비스 0개로 확인됐다.

## 검증 매트릭스

| # | 항목 | 결과 | 증거 |
| --- | --- | --- | --- |
| 1 | fresh 앱 스캐폴드(workspace 밖, npm) + 타르볼 설치 | PASS | `npm create vite@latest agentic-prd-smoke -- --template react-ts` 후 `npm i <widget .tgz>` / `npm i -D <dev-plugin .tgz>` (Vite 8.1.1, React 19.2.7) |
| 2 | README quickstart 문자 그대로 적용 | PASS | `vite.config.ts` 에 `agenticPRDDev()`, `App.tsx` 에 `<CommentWidget pageKey={location.pathname} />` 만 추가. Tailwind 없는 템플릿이라 스타일 단계는 스킵(README 의 "v4 호스트만" 문구와 일치) |
| 3 | 디스커버리 파일 위치 | PASS | `.agentic-prd.dev.json` = `{"port":5173,"prefix":"/__agentic-prd"}` 가 **앱 루트**에 생성(모노레포/스크래치 루트 오염 없음) |
| 4 | API 왕복 | PASS | `GET /threads`→`[]` · `POST /threads`→201 · `GET ?path=/`→포함 · `POST /threads/:id/comments`→200 · `comments.json` 반영 · `resolve`→200 · `DELETE`→200 후 `[]` |
| 5 | 프로덕션 빌드 | PASS | `npm run build`(tsc -b + vite build) 통과. dev-plugin 코드(`configureServer` 등) 번들 미포함 — 번들 내 `__agentic-prd` 문자열은 위젯의 엔드포인트 상수(폴백 경고 경로)로 정상 |
| 6 | preview 서빙 | PASS | `npx vite preview` HTTP 200, HTML/JS 자산 정상 |
| 7 | 위젯 브라우저 실동작(fresh 앱, npm 설치본) | PASS | Playwright(chromium): 툴바 표시 → 이름(localStorage) → 코멘트 모드 → 대상 클릭 → 한글 insertText → 제출 → `목록 1` → **reload 후 핀 유지** → `comments.json` 에 anchor(scopeChain/selector/relX/relY/reactPath/reactSource) 저장, page error 0 |
| 8 | 플러그인 스키마 검증 | PASS | `claude plugin validate .` → "Validation passed with warnings" (marketplace description / plugin author 미기재 경고 2건, 비차단) |
| 9 | 마켓플레이스 설치 리허설 | 부분(수동 확인 필요) | CLI 비대화형으론 `/plugin marketplace add` 를 검증할 수 없음. validate 통과로 대체. **사용자 수동 확인 절차**: 새 Claude Code 세션에서 `/plugin marketplace add <repo 경로 또는 CreeJee/agentic-prd>` → `/plugin install agentic-prd@agentic-prd` → dev 서버 켠 앱에서 `/agentic-prd:list-threads` |
| 10 | 모노레포 회귀 typecheck/lint/test/build | PASS | 5/5·2/2·4/4(68 tests)·3/3 — 모두 green |
| 11 | playground e2e(시드) | PASS | `pnpm --filter agentic-prd-playground test:e2e` → 3 passed(5.3s), supabase 없이 자체 webServer(5199) 기동. `.agentic-prd/comments.json` 에 6 스레드(전부 anchor 보유) + specs 3건 시드 |

## 재현 절차 (요약)

```bash
# 타르볼 (repo 에서 준비)
pnpm build && (cd packages/widget && pnpm pack) && (cd packages/dev-plugin && pnpm pack)

# fresh 앱
npm create vite@latest my-app -- --template react-ts && cd my-app && npm i
npm i <path>/agentic-prd-widget-0.1.0.tgz
npm i -D <path>/agentic-prd-dev-plugin-0.1.0.tgz
# vite.config.ts 에 agenticPRDDev(), App.tsx 에 <CommentWidget pageKey={location.pathname} />
npm run dev
cat .agentic-prd.dev.json   # {port, prefix}
curl -sf "http://localhost:{port}/__agentic-prd/threads"
```

## 발견·수정한 문제 (이번 루프 이전 태스크에서 처리 완료)

- dev-plugin `publishConfig` 가 실존하지 않는 `dist/index.js`/`index.d.ts` 를
  가리킴 → 실제 산출물(`index.mjs`/`index.d.mts`)로 정정 (Task 8).
- 위젯 `useUpdateAnchor` 가 Supabase 시절 `y_pct: yPx` 키로 patch 하던 잠복 버그
  → StorageAdapter 전환 시 camelCase `{xPct, yPx}` 로 수정 (Task 6).
- Vite 가 이 환경(win32)에서 host 미지정 시 `[::1]` 에만 바인딩 → skill/README 는
  `localhost` 사용을 명시, e2e webServer 는 `--host 127.0.0.1` 명시(기존 처리 유지).

## 환경 특이사항 (제품 결함 아님)

- Chrome 확장(claude-in-chrome) 이 localhost 오리진에서 에러 페이지만 반환해
  브라우저 스텝은 Playwright 로 수행(curl/Playwright 는 동일 서버 정상 접속).
- Git Bash 의 curl `-d` 리터럴 한글은 시스템 코드페이지로 전송돼 모지바케 —
  파일(`-d @file`) 또는 Playwright/insertText 경로에선 문제 없음.

## 백로그

- ~~앵커 캡처 시 애니메이션 정착 대기~~ — **검토 후 기각(2026-07-13).**
  `buildCapture` 는 클릭 좌표·rect 를 같은 틱에 읽어 분수를 만들므로
  scale/translate 애니메이션에 불변(이미 정확). `getAnimations().finished` 대기
  후 재읽기는 클릭 좌표 staleness 로 slide-in 케이스를 회귀시킴. 상세는
  AGENTS.md 함정 섹션 참조.
- cloudStorage 어댑터(도메인 분리·조직 요금제) — `StorageAdapter` 인터페이스가
  계약. dev-plugin HTTP API 가 클라우드 API 초안.
- Tailwind 비의존 스타일(자체 CSS 번들 옵션) — 현재 비 Tailwind v4 호스트는
  무스타일 렌더(기능은 동작).
- 번들 사이즈: fresh 앱 단일 청크 ~1MB(위젯+lexical). dynamic import 가이드 검토.
- dev-plugin 타르볼의 `src/`(테스트 포함) 동봉은 선택적 경량화 여지.
- marketplace description / plugin author 필드 추가(validate 경고 2건 해소).

## 남은 수동 확인 (사용자)

1. 새 Claude Code 세션: `/plugin marketplace add CreeJee/agentic-prd`(push 후) 또는
   로컬 경로 add → `/plugin install agentic-prd@agentic-prd`.
2. dev 서버 켠 앱에서 `/agentic-prd:list-threads` → 스레드 조회 확인.
3. npm publish (`packages/widget`, `packages/dev-plugin` 에서 `npm publish` —
   `publishConfig.access: public` 설정 완료).
