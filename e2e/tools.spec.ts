import { test, expect } from "@playwright/test";

function uniqueEmail() {
  return `e2e-tools-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: import("@playwright/test").Page) {
  const email = uniqueEmail();
  await page.goto("/signup");
  await page.fill("#email", email);
  await page.fill("#password", "e2e-test-password-123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

// A brand-new signup always starts at balance 0 (the auth trigger creates
// credits with balance=0 — see 0002_auth_trigger.sql), so every paid tool
// must show the pre-flight gate rather than a usable upload flow. This is
// the "gate-then-run" contract from ARCHITECTURE.md § 6: the credit gate
// blocks BEFORE any processing UI is usable, not after.
for (const path of ["/tools/image-compressor", "/tools/passport-photo"]) {
  test(`${path} shows the insufficient-credits gate for a zero-balance user`, async ({ page }) => {
    await signUp(page);
    await page.goto(path);
    await expect(page.getByText(/insufficient credits/i)).toBeVisible({ timeout: 10_000 });
  });
}

// The Hindi Converter has no client-side pre-flight gate (ARCHITECTURE.md §
// 8: it settles credits server-side in the same call that computes the
// result, unlike the client-reported-success pattern the other two tools
// use), so a zero-balance user only finds out via the server's
// INSUFFICIENT_CREDITS error after clicking Convert, not a static banner.
// This also exercises the real mapping module (Phase 9/10, TODO.md M1):
// the input is valid Kruti Dev text and conversion would succeed if the
// user had a balance, so this test is really checking the credit gate, not
// mapping correctness (see src/lib/hindi/__tests__/golden-corpus/ for that).
test("hindi converter blocks conversion for a zero-balance user via the credit gate, not a fabricated result", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/tools/hindi-converter");

  await page.locator("textarea").first().fill("dqN Hkh");
  await page.click('button:has-text("Convert")');

  await expect(page.getByText(/insufficient_credits|insufficient_balance/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("textarea").nth(1)).toHaveValue("");
});
