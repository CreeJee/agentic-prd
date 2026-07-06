# 에이전틱 루프 검증 리포트

- 날짜: 2026-07-07
- 설계: `2026-07-07-playground-demo-agentic-verification-design.md`
- 대상 커밋: `3d641db`…`f9877ff` (수정 6건), 시드 하네스 `77fb4af`

## 요약

**성공 기준(6건 중 5건 이상) 초과 달성: 6/6.**

| 지표 | 결과 |
|---|---|
| 위치 특정 — 정답 파일이 후보 top-5 내 | **6/6** (top-1 4건, top-2 2건) |
| 정답 수정 적용 (블라인드 서브에이전트) | **6/6** — 전부 의도된 해법과 일치 |
| 코멘트 시드 경로 | 6/6 실제 위젯 UI (Chrome 자동화, 한글 입력 포함) |
| 수정 라이브 확인 | /products 콤마·품절 배지·흐림, /checkout 이메일·배송 에러 — 브라우저 실확인 |

검증 방법: 코멘트를 남긴 화면/코드의 정답표를 **모르는** 서브에이전트에게 스레드 정보(코멘트 본문 + anchor JSON + `/threads/:id/location` 후보 + 해당 path 의 PRD)만 제공하고 최소 수정을 지시. 수정 후 메인 세션이 정답표와 대조 채점, `/threads/:id/resolve` 로 종결.

## 결함별 채점표

| # | 코멘트 (화면) | 정답 파일 | 후보 내 정답 순위 | 수정 결과 |
|---|---|---|---|---|
| 1 | 가격 천단위 콤마 (/products) | Products.tsx | **1위** (reactSource, conf 1.0) | ✅ `toLocaleString()` — 의도 일치 |
| 2 | 품절 시각 구분 (/products) | Products.tsx | **1위** (reactSource) | ✅ 흐림+배지+담기 차단 — 의도 일치 |
| 3 | 수량 max 없음 (/products 상세 Dialog) | Products.tsx | **2위** (testid 0.8) — 1위는 위젯 dist 오탐 | ✅ `max={99}`+클램프 — 의도 일치 |
| 4 | 빈 장바구니 결제 활성 (/cart) | Cart.tsx | **1위** (reactSource) + testid 가 정확 라인(91) | ✅ disabled+안내 — 의도 일치 |
| 5 | 이메일 형식 검증 (/checkout) | Checkout.tsx | **1위** (reactSource) + testid 라인(79) | ✅ 패턴 검증+PRD 문구 — 의도 일치 |
| 6 | 배송방법 필수 (/checkout Select) | Checkout.tsx | **2위** (testid 0.8) — 1위는 위젯 dist 오탐 | ✅ 검증+에러 문구 — 의도 일치 |

블라인드 에이전트들은 오탐 후보(위젯 dist)를 "UI 라이브러리 내부"라는 단서로 스스로 기각하고 testid 후보를 채택했다 — 후보 목록에 evidence(kind) 가 붙어 있는 것이 판단에 유효했다.

## 데이터 생성 경로 검증

### 1차: claude-in-chrome (호스티드, 이 리포트의 채점 대상)
- 닉네임 설정 → 코멘트 모드 → 대상 클릭 → 본문 입력 → 제출 전 과정이 실제 위젯 UI 로 동작.
- **한글 입력 성공** (CDP insertText 경로, IME 폴백 불필요 — 설계의 "영문 폴백" 리스크 미발생).
- SpecPanel 로 PRD 3건 작성(제목+본문, 자동저장) 성공.
- 한계 2건: ① react-router `Link` 클릭이 1회 씹힘(재클릭으로 해결, 원인 미상 단발) ② SpecPanel 의 status 드롭다운(base-ui Select)이 합성 클릭으로 열리지 않음 → DRAFT 유지로 우회.

### 2차: Playwright + 로컬 Supabase (재현 가능 경로, Task 9)
- `supabase start`(마이그레이션 `20260707000000_demo_tables.sql`) + global-setup truncate → **항상 빈 상태에서 시작 보장**.
- 3 spec 파일, 2회 연속 3 passed, 코멘트 6건 anchor 전부 캡처(중첩 Dialog scopeChain 포함).
- 실행: `supabase start` 후 `pnpm --filter agentic-prd-playground test:e2e`.
- **통합 갭(최종 리뷰 발견, `b29125a` 수정)**: 결함 4 수정으로 빈 장바구니의 결제 버튼이 disabled 가 되자 /cart 시드 테스트가 클릭 불가로 깨짐 → 시드 전에 상품을 담고 SPA 네비게이션으로 이동하도록 수정, 수정 후 데모 기준 3 passed 재확인. 교훈: 시드 도구는 데모 코드 변경과 함께 재실행돼야 한다.

## 발견된 개선 백로그

### anchor-resolver (dev-plugin)
1. **위젯 번들 경로 오탐**: 클릭 대상이 위젯이 제공한 오버레이(base-ui Dialog/Select) 내부면 reactSource 가 `packages/widget/dist/index.js` 를 confidence 1.0 으로 가리킴(#3·#6의 1위 오탐). `dist/`·`node_modules/` 파일은 감점 또는 제외하고 testid/앱 소스 후보를 상향해야 함.
2. **reactSource 경로 정규화**: dev 서버 상대경로(`/src/routes/…`)가 그대로 노출됨. 워크스페이스 상대경로(`apps/playground/src/…`)로 매핑해야 에이전트가 추가 추론 없이 열 수 있음 (#1·#2·#4·#5에서 에이전트가 수동 매핑함).

### widget
3. **중첩 오버레이 aria-hidden 상호 마킹**: 호스트 base-ui Dialog 와 위젯 오버레이가 서로의 서브트리를 `aria-hidden` 처리 → 접근성 트리 기반 쿼리(getByRole)가 불안정 (Task 9 에서 발견, XPath 로 우회). 스크린리더 사용자에게도 잠재 회귀.
4. **툴바/컴포저에 안정 셀렉터 부재**: e2e 가 `z-99992` 유틸 클래스에 의존. `DraggableToolbar` 루트와 `DraftComposer` 제출 버튼에 `data-testid` 필요.
5. **닫힌 오버레이 스코프 핀의 폴백 위치**: Dialog 안에 단 핀이 Dialog 닫힘 상태에서 무관한 카드 근처(절대좌표 폴백)에 렌더 — 트리거 셀렉터 옆에 붙이거나 흐림 표시가 자연스러움.
6. **SpecPanel status Select 합성 클릭 미동작**: 자동화 관점 한계(수동 사용은 정상). 원인 추적 필요 시 base-ui Select 의 pointerdown 시퀀스 확인.

## 결론

코멘트→코드수정 루프는 **실제 에이전틱 개발에 쓸 수 있는 품질**로 판정한다. 위젯이 캡처한 anchor(testid selector + reactPath + scopeChain)와 dev-plugin 의 후보 목록만으로, 코드베이스를 모르는 에이전트가 6/6 결함을 정확한 파일에서 의도된 방식으로 수정했다. PRD 동기화(sync-specs)는 코멘트가 짧아도 정책 문구(에러 메시지 원문 등)를 수정에 반영하게 하는 데 실질적으로 기여했다. 남은 것은 resolver 랭킹 2건(백로그 1·2)으로, 이는 top-1 정확도(현재 4/6)를 올리는 개선이지 루프 성립의 전제조건이 아니다.
