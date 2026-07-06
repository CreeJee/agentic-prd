# Playground 커머스 데모 + 에이전틱 루프 검증 설계

- 날짜: 2026-07-07
- 상태: 승인됨 (설계)
- 목표: 위젯으로 남긴 코멘트/PRD가 dev-plugin + Claude Code skill 경로를 통해 **실제 에이전틱 개발(코멘트 → 소스 위치 특정 → 코드 수정 → resolve)에 쓸 수 있는 품질**인지 E2E 로 검증한다.

## 배경

현재 `apps/playground` 는 라우터 없는 단일 키친싱크 페이지(앵커 에지케이스 시험용)라, "기획자가 실제 화면에 코멘트를 남기고 에이전트가 고친다" 시나리오를 돌리기엔 콘텐츠가 인위적이다. 검증의 핵심은 두 가지:

1. **앵커 캡처 품질** — 코멘트가 *진짜 위젯 UI 경로*로 만들어졌을 때, anchor(scope chain, selector, reactPath)가 에이전트에게 충분한 소스 위치 단서를 주는가.
2. **PRD 맥락 결합** — 코멘트가 짧아도("여기 콤마 빠졌어요") 화면별 PRD 를 sync 해 맥락을 보강하면 올바른 수정에 도달하는가.

## 결정 사항 (사용자 확정)

- 검증 시나리오: **코멘트 → 코드수정 루프**, 단 PRD 맥락이 함께 있는 상태로.
- 데모 소재: shadcn examples 스타일의 **커머스 미니앱** (상품 목록 / 장바구니 / 체크아웃).
- 라우팅: **react-router** 도입, `pageKey={useLocation().pathname}` 호스트 주입 패턴 시연.
- 기존 키친싱크: **`/_kitchen-sink` 라우트로 보존** (앵커 회귀 시험 자산).
- 데이터 생성: **1차 Chrome 자동화**(claude-in-chrome, 실제 위젯 경로) → **2차 Playwright 시드 스펙**. Playwright 경로는 **로컬 Supabase** 를 써서 항상 빈 상태에서 시작함을 보장.

## 1. 데모 앱 구조

```
apps/playground/src/
├─ index.tsx            # BrowserRouter 마운트
├─ App.tsx              # 레이아웃(네비 헤더) + Routes + CommentWidget(pageKey 주입)
├─ cart.tsx             # CartProvider(Context+useState) — 장바구니 상태
├─ data.ts              # 데모 상품 목록(품절 포함) 정적 데이터
└─ routes/
   ├─ Products.tsx      # /products — 카드 그리드 + 상품 상세 Dialog(수량 입력)
   ├─ Cart.tsx          # /cart — 테이블 + 수량 조절 + 합계 + 결제 버튼
   ├─ Checkout.tsx      # /checkout — 배송/결제 폼 + 배송방법 Select
   └─ KitchenSink.tsx   # /_kitchen-sink — 기존 App.tsx 콘텐츠 이동
```

- `/` 는 `/products` 로 redirect.
- UI 는 플레이그라운드 자체 Tailwind 마크업(shadcn 룩 모방). 위젯이 export 하는 `Dialog`/`Select` 프리미티브는 재사용하되, shadcn CLI 를 플레이그라운드에 새로 세팅하지 않는다 — 데모 앱은 "임의의 호스트 앱"을 대변해야 하므로 위젯 의존을 늘리지 않는 게 현실적.
- 장바구니 상태는 React Context + useState 수준 (라이브러리 추가 없음).
- `CommentWidget` 은 레이아웃에서 한 번 마운트, `pageKey={pathname}` / `pageLabel`(화면 한글명) 주입.

## 2. Planted issues — 의도적 결함 6건

앵커 유형 커버리지를 갖도록 화면마다 결함을 심는다. 각 결함은 해당 화면 PRD 에 "정책"으로 먼저 기술된다.

| # | 화면 | 결함 | 검증하는 앵커 유형 |
|---|------|------|--------------------|
| 1 | /products | 가격에 천단위 콤마 누락 (`1290000원`) | 일반 엘리먼트 앵커 |
| 2 | /products | 품절 상품이 시각적으로 구분 안 됨 | 반복 리스트(row/card) 앵커 |
| 3 | /products 상세 Dialog | 수량 입력에 최대 99 제한 없음 | Dialog 스코프체인 앵커 |
| 4 | /cart | 장바구니 비어도 결제 버튼 활성 | 상태 로직 (버튼 앵커) |
| 5 | /checkout | 이메일 형식 검증 없음 | 폼 필드 앵커 |
| 6 | /checkout | 배송방법 Select 미선택인데 에러 안내 없음 | 중첩 오버레이(Select) 앵커 |

## 3. PRD 시드 — 화면별 3개 스펙

- `/products` — 상품 노출 정책: 가격은 `1,290,000원` 천단위 콤마 표기, 품절 상품은 흐림 처리 + "품절" 배지, 상세 수량은 1~99.
- `/cart` — 장바구니 규칙: 빈 장바구니면 결제 버튼 비활성 + 안내 문구, 합계는 실시간 재계산.
- `/checkout` — 체크아웃 validation 정책: 이메일 형식 검증, 배송방법 필수 선택(미선택 시 에러 문구).

스펙은 위젯 SpecPanel 로 남기는 것을 우선하되(자동화), 실패 시 Supabase insert 로 대체 허용 — 스펙은 앵커 캡처가 없어 seed 로도 검증 가치가 동일하다.

## 4. 데이터 생성 파이프라인

### 1차: Chrome 자동화 (claude-in-chrome)

- 실제 위젯 UI 로 핀 클릭 + 코멘트 작성. **위젯 캡처 경로(fiber/selector/scope chain)를 실제로 태우는 것**이 목적.
- 한글 IME 가 합성 이벤트 제약으로 막히면 코멘트 본문을 영문으로 폴백 — 본문 언어보다 앵커 캡처 경로 검증이 우선.
- 대상: 호스티드 Supabase (현행 playground 설정 그대로).

### 2차: Playwright 시드 스펙 (반복 가능 경로)

- `apps/playground/e2e/seed-comments.spec.ts` — 6건 코멘트를 실제 위젯 UI 조작으로 남기는 시나리오.
- **로컬 Supabase**: `supabase start` (기존 `supabase/` 마이그레이션 재사용). global-setup 에서 `demo_comments`/`demo_specs` truncate → 항상 빈 상태 시작 보장.
- `apps/playground/vite.config.ts` 의 storage 를 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLIC_KEY` env 기반으로 전환. **기본값은 현재 호스티드 값** → env 미설정 시 기존 동작 무변화. dev-plugin 옵션도 동일 값을 공유.
- Playwright `webServer` 로 vite dev 서버 기동(dev-plugin 사이드카 포함).

## 5. 검증 프로토콜

시드 완료 후, 소스 힌트 없이 **skill 경로만으로** 에이전틱 루프를 실행한다:

1. `/agentic-prd:sync-specs` — PRD 3건을 `docs/specs/` 로 내려받아 맥락 확보.
2. `/agentic-prd:list-threads` — 6개 스레드 확인.
3. 각 스레드에 대해 `/agentic-prd:thread <id>` — location candidates 에 **정답 파일이 top-5 내 포함**되는지 기록.
4. 코멘트 + PRD 만으로 수정을 적용하고 `/agentic-prd:resolve <id>`.
5. 수정이 planted issue 의 의도된 해법과 일치하는지 채점.

### 성공 기준

- **6건 중 5건 이상**: 정확한 소스 위치 특정(top-5) **그리고** 의도된 수정 적용.
- 실패 건은 anchor 캡처/anchor-resolver 개선 백로그로 기록.
- 결과는 `docs/superpowers/specs/2026-07-07-agentic-loop-verification-report.md` 로 남긴다.

## 에러 처리 / 리스크

- **Chrome 자동화에서 위젯 코멘트 모드 진입 실패** (window-capture 와 합성 이벤트 충돌 가능): Playwright 경로로 폴백. Playwright 는 신뢰 이벤트에 가까워 성공 확률이 높다.
- **한글 IME**: 자동화 불가 시 영문 본문 폴백. 검증 대상은 앵커이지 본문 언어가 아님.
- **로컬 Supabase 미기동**(docker 없음 등): Playwright 시드는 스킵 가능해야 하며, 그 경우 1차(호스티드) 결과만으로 검증 리포트를 작성.
- **resolver 후보 miss**: 실패 자체가 검증의 산출물 — 백로그화하고 성공 기준 계산에 포함.

## 테스트

- 기존: `pnpm typecheck` 0 + biome(error) 클린 유지.
- 신규: Playwright 시드 스펙은 "시드 도구"이자 위젯 상호작용 회귀 테스트로 겸용. CI 편입은 이번 범위 밖(로컬 Supabase 의존).
- 데모 앱 자체의 단위 테스트는 두지 않음 (데모/검증 픽스처 성격).

## 범위 밖 (YAGNI)

- 데모 앱의 실제 결제/백엔드 연동.
- Playwright CI 파이프라인 편입.
- react_trace_frames 류 추가 텔레메트리.
- 위젯/dev-plugin 본체 기능 변경 — 검증 중 발견된 개선점은 백로그로만 기록.
