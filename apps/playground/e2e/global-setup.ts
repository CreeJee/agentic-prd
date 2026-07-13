/**
 * Playwright 전역 셋업: dev-plugin 로컬 저장소(.agentic-prd/)를 빈 상태로 초기화하고
 * PRD 3건을 시드한다. 코멘트는 UI 경로 검증이 목적이라 spec 파일에서 위젯으로 남기고,
 * PRD 는 앵커가 없어 파일 직접 쓰기로 충분하다. 저장소 루트는 dev-plugin 의 루트 규칙
 * (pnpm-workspace.yaml 이 있는 workspace 루트)과 동일해야 한다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.agentic-prd"
);

const PRODUCTS_PRD = `## 상품 노출 정책

- 가격은 천단위 콤마를 넣어 \`1,290,000원\` 형식으로 표기한다.
- 품절 상품은 카드 전체를 흐림 처리하고 "품절" 배지를 표시하며, 장바구니 담기를 막는다.
- 상세 다이얼로그의 수량은 1 이상 99 이하만 입력할 수 있다.`;

const CART_PRD = `## 장바구니 규칙

- 장바구니가 비어 있으면 결제하기 버튼을 비활성화하고 "상품을 먼저 담아주세요" 안내를 보여준다.
- 합계는 수량 변경 즉시 재계산한다.`;

const CHECKOUT_PRD = `## 체크아웃 validation 정책

- 이메일은 형식(\`local@domain\`)을 검증하고, 불일치 시 "올바른 이메일 형식이 아닙니다"를 보여준다.
- 배송 방법은 필수 선택이다. 미선택 제출 시 "배송 방법을 선택하세요" 에러를 보여준다.`;

function specRow(id: string, path: string, title: string, body: string) {
  return {
    id,
    path,
    title,
    status: "CONFIRMED",
    sections: { body },
    updated_by: "검증봇",
    updated_at: new Date().toISOString(),
  };
}

async function globalSetup() {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, "comments.json"), "[]\n", "utf8");
  writeFileSync(
    join(DATA_DIR, "specs.json"),
    `${JSON.stringify(
      [
        specRow(
          "spec_seed_products",
          "/products",
          "상품 목록 정책",
          PRODUCTS_PRD
        ),
        specRow("spec_seed_cart", "/cart", "장바구니 정책", CART_PRD),
        specRow(
          "spec_seed_checkout",
          "/checkout",
          "체크아웃 정책",
          CHECKOUT_PRD
        ),
      ],
      null,
      2
    )}\n`,
    "utf8"
  );
}

export default globalSetup;
