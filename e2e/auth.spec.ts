import { test, expect } from "@playwright/test";

// Requires a reachable Supabase instance (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY)
// with email confirmations disabled, matching local dev (`supabase start`).
// See DEPLOYMENT.md for how CI should provide this.

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

test("signup creates an account and lands on the dashboard", async ({ page }) => {
  const email = uniqueEmail();

  await page.goto("/signup");
  await page.fill("#email", email);
  await page.fill("#password", "e2e-test-password-123");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  await expect(page.getByText(email)).toBeVisible();
});

test("logout then login returns to the dashboard", async ({ page }) => {
  const email = uniqueEmail();
  const password = "e2e-test-password-123";

  await page.goto("/signup");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

  await page.click('button:has-text("Log out")');
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
});

test("unauthenticated access to a protected route redirects to login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});
