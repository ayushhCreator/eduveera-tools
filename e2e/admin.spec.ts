import { test, expect } from "@playwright/test";

function uniqueEmail() {
  return `e2e-admin-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

test("a non-admin user is redirected away from /admin", async ({ page }) => {
  const email = uniqueEmail();

  await page.goto("/signup");
  await page.fill("#email", email);
  await page.fill("#password", "e2e-test-password-123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  await expect(page.getByText("Admin Dashboard")).not.toBeVisible();
});
