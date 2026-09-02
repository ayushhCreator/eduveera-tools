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

test("hindi converter never shows a fabricated result for unsupported input", async ({ page }) => {
  await signUp(page);
  await page.goto("/tools/hindi-converter");

  await page.locator("textarea").first().fill("यह हिंदी में एक वाक्य है।");
  await page.click('button:has-text("Convert")');

  await expect(page.getByText(/unsupported|under construction|not available/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("textarea").nth(1)).toHaveValue("");
});
