/**
 * Playwright 전역 셋업: 로컬 Supabase 를 빈 상태로 초기화하고 PRD 3건을 시드한다.
 * 코멘트는 UI 경로 검증이 목적이라 spec 파일에서 위젯으로 남기지만, PRD 는 앵커가
 * 없어 직접 insert 로 충분하다 (설계 문서 §3).
 */
import { createClient } from "@supabase/supabase-js";
import {
  LOCAL_SUPABASE_SERVICE_KEY,
  LOCAL_SUPABASE_URL,
} from "./local-supabase";

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

async function globalSetup() {
  const sb = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_KEY);
  const wipeComments = await sb.from("demo_comments").delete().neq("id", "");
  if (wipeComments.error) throw new Error(wipeComments.error.message);
  const wipeSpecs = await sb.from("demo_specs").delete().neq("id", "");
  if (wipeSpecs.error) throw new Error(wipeSpecs.error.message);

  const seeded = await sb.from("demo_specs").insert([
    {
      id: "spec_seed_products",
      path: "/products",
      title: "상품 목록 정책",
      status: "APPROVED",
      sections: { body: PRODUCTS_PRD },
      updated_by: "검증봇",
    },
    {
      id: "spec_seed_cart",
      path: "/cart",
      title: "장바구니 정책",
      status: "APPROVED",
      sections: { body: CART_PRD },
      updated_by: "검증봇",
    },
    {
      id: "spec_seed_checkout",
      path: "/checkout",
      title: "체크아웃 정책",
      status: "APPROVED",
      sections: { body: CHECKOUT_PRD },
      updated_by: "검증봇",
    },
  ]);
  if (seeded.error) throw new Error(seeded.error.message);
}

export default globalSetup;
