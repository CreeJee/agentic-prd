/**
 * 실제 위젯 UI 경로(코멘트 모드 → 대상 클릭 → 에디터 입력 → 제출)로 planted
 * issue 6건에 코멘트를 시드한다. 앵커 캡처(fiber/selector/scope chain)가 진짜
 * 사용자 경로로 만들어지는 것이 목적이므로 Supabase 직접 insert 를 쓰지 않는다.
 */
import { expect, type Page, test } from "@playwright/test";

const AUTHOR = "검증봇";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([value]) => {
      window.localStorage.setItem("comment-widget-name", value ?? '""');
    },
    [JSON.stringify(AUTHOR)]
  );
});

/**
 * 상세 다이얼로그(호스트 base-ui Dialog)와 위젯 컴포저(overlay-kit popover)가
 * 동시에 열리면 서로 다른 모달 구현이 각자 상대 subtree 를 독립적으로
 * aria-hidden 처리해(포인터 클릭 자체는 막지 않음 — inert 아님) getByRole 질의가
 * 불안정해진다. 툴바는 AGENTS.md 에 문서화된 고정 z-index 클래스(z-99992)로 스코프하고,
 * 컴포저 제출 버튼은 "툴바가 아닌 코멘트 버튼"으로 구조 기반 매칭한다.
 */
function toolbarButton(page: Page, label: string) {
  return page.locator(
    `xpath=//div[contains(concat(" ", normalize-space(@class), " "), " z-99992 ")]//button[normalize-space(string(.))="${label}"]`
  );
}

function composerSubmitButton(page: Page) {
  return page.locator(
    'xpath=//button[normalize-space(string(.))="코멘트" and not(ancestor::div[contains(concat(" ", normalize-space(@class), " "), " z-99992 ")])]'
  );
}

async function leaveComment(
  page: Page,
  targetTestId: string,
  text: string,
  expectedCount: number
) {
  await toolbarButton(page, "코멘트").click();
  await page.getByTestId(targetTestId).click();
  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.insertText(text);
  await composerSubmitButton(page).click();
  await expect(toolbarButton(page, `목록 ${expectedCount}`)).toBeVisible({
    timeout: 10_000,
  });
}

test("seed /products comments (issues 1-3)", async ({ page }) => {
  await page.goto("/products");
  await leaveComment(
    page,
    "product-price-p1",
    "가격에 천단위 콤마가 빠졌어요. 상품 노출 정책의 표기 형식대로 고쳐주세요.",
    1
  );
  await leaveComment(
    page,
    "product-card-p3",
    "품절 상품이 일반 상품과 똑같이 보여요. 정책대로 흐림 처리하고 품절 배지를 달아주세요.",
    2
  );
  await page.getByTestId("product-open-p1").click();
  await leaveComment(
    page,
    "product-qty-input",
    "수량을 999까지 입력할 수 있어요. 최대 99로 제한해주세요.",
    3
  );
});

test("seed /cart comment (issue 4)", async ({ page }) => {
  await page.goto("/cart");
  await leaveComment(
    page,
    "cart-pay-button",
    "장바구니가 비어 있는데 결제하기 버튼이 눌려요. 규칙대로 비활성화하고 안내 문구를 보여주세요.",
    1
  );
});

test("seed /checkout comments (issues 5-6)", async ({ page }) => {
  await page.goto("/checkout");
  await leaveComment(
    page,
    "checkout-email-input",
    "이메일에 아무 문자나 넣어도 통과돼요. validation 정책대로 형식 검증을 추가해주세요.",
    1
  );
  await leaveComment(
    page,
    "shipping-select-trigger",
    "배송 방법을 안 골랐는데 에러 안내 없이 주문이 돼요. 필수 선택으로 만들어주세요.",
    2
  );
});
