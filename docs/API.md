# Eduveera Tools — API / Server Action Surface

Implemented as Next.js Server Actions unless noted. "Auth: required" means the action calls `supabase.auth.getUser()` server-side and rejects if there's no session — the user id is **always** derived from the session, never from a request parameter. "Authz" lists any additional check beyond "is logged in."

Canonical tables referenced: `profiles`, `credits`, `credit_transactions`, `payments`, `tool_usage`, `admin_users`, `pricing_plans`, `tool_pricing` — see [DATABASE.md](DATABASE.md).

## 1. Authentication

Handled by Supabase Auth SDK directly from the client (`supabase.auth.signUp`, `signInWithPassword`, `signOut`) — no custom server actions needed for these; Supabase issues the session cookie via `@supabase/ssr`.

### `getSession()` (server, used in layouts/middleware)
- **Purpose:** resolve the current user for server components / route guards.
- **Auth:** none required (returns null if unauthenticated).
- **Authz:** none.
- **Response:** `{ user: { id, email } | null }`.

## 2. User Profile

### `getMyProfile()`
- **Purpose:** fetch the signed-in user's profile + credit balance for the dashboard.
- **Auth:** required.
- **Authz:** none beyond auth — always scoped to the caller's own `id`.
- **Request:** none.
- **Response:** `{ id, name, email, phone, status, balance }` (joins `profiles` + `credits`).
- **Errors:** `401` if unauthenticated.

## 3. Credits

### `getCreditBalance()`
- **Purpose:** read current balance.
- **Auth:** required.
- **Authz:** own row only (`WHERE user_id = auth.uid()`, also enforced by RLS).
- **Response:** `{ balance: number }`.
- **Credit behavior:** read-only, no mutation.

### `getMyTransactions({ page, pageSize })`
- **Purpose:** paginated ledger view for the user's dashboard.
- **Auth:** required.
- **Authz:** own rows only.
- **Request:** `{ page: number, pageSize: number (max 50) }`.
- **Response:** `{ items: CreditTransaction[], total: number }`.
- **Validation:** `pageSize` clamped server-side to 50 regardless of client input.
- **Credit behavior:** read-only.

There is **no** public action to directly mutate `credits` or `credit_transactions`. All mutation happens as a side effect of the actions below, executed via the transactional DB functions defined in [DATABASE.md](DATABASE.md) § Transaction requirements.

## 4. Tool Execution

Each tool follows the same two-step shape described in [ARCHITECTURE.md](ARCHITECTURE.md) § 6: client does the work (image tools) or server computes the result (Hindi), then a server action finalizes success/failure and settles credits atomically. Cost is always read server-side from `tool_pricing` — never accepted from the client.

### `getToolPricing()`
- **Purpose:** display "this costs N credits" before the user commits, and drive the client-side pre-flight gate below.
- **Auth:** required.
- **Authz:** none beyond auth.
- **Response:** `{ image_compressor: number, passport_photo: number, hindi_converter: number }`.

### Pre-flight gate (client-side, Image Compressor / Passport Photo only)
Before the client starts any Canvas/WASM processing, the tool page calls `getCreditBalance()` and `getToolPricing()` and disables the process/compress action if `balance < cost[tool]`, showing an insufficient-credits state instead. This is what makes the credit gate real for these two tools: it fires **before** a usable output exists, not after (see [ARCHITECTURE.md](ARCHITECTURE.md) § 6, "gate-then-run"). It is a UX gate only — `recordToolResult` below is still the authoritative, re-checked enforcement point.

### `recordToolResult({ tool, status, metadata })` — Image Compressor / Passport Photo
- **Purpose:** finalize a client-side image-processing attempt, after the pre-flight gate has already passed: settle credits on success, log the attempt either way.
- **Auth:** required.
- **Authz:** own action only.
- **Request:** `{ tool: 'image_compressor' | 'passport_photo', status: 'success' | 'failed', metadata: { presetOrParams: object, originalKB?: number, finalKB?: number } }`.
- **Validation:**
  - `tool` must be one of the two enum values (Hindi converter uses a different action, below).
  - If `status = 'success'`: `metadata.finalKB` must be present and, for Image Compressor, plausible against the requested preset (e.g. `finalKB <= presetTargetKB * 1.05` tolerance) — implausible claims are rejected as `422` rather than silently trusted (see [ARCHITECTURE.md](ARCHITECTURE.md) § 6 trust-but-verify note).
  - Server re-checks current balance ≥ `tool_pricing.cost_credits` for that tool before debiting — this re-check exists because the pre-flight gate and this call are not atomic with each other (balance could change in between, e.g. a concurrent debit); insufficient balance here → `402`, no `tool_usage` row with `success` is created (a `failed` one may be logged for observability, with `credits_charged = 0`). This should be rare in practice since the pre-flight gate already screened for it.
- **Response:** `{ success: true, newBalance: number, creditsCharged: number }` or `{ success: false, error: string }`.
- **Errors:** `401` unauthenticated · `402` insufficient credits (rare post-gate race) · `422` implausible/invalid metadata.
- **Credit behavior:** debits `tool_pricing.cost_credits[tool]` **only** when `status = 'success'` and the plausibility check passes; on `status = 'failed'`, no debit, `tool_usage` logged with `credits_charged = 0`. Debit + `tool_usage` insert + `credits.balance` update happen in one DB transaction.
- **Known residual gap:** because processing happens client-side before this call, a user could technically extract the processed output without ever calling this action, dodging the charge. Accepted trade-off for this budget — see [ARCHITECTURE.md](ARCHITECTURE.md) § 6.

### `detectTextEncoding({ text })` — Smart Detection
- **Purpose:** classify pasted text before conversion.
- **Auth:** required (rate-limiting anchor; see [SECURITY.md](SECURITY.md)).
- **Authz:** none beyond auth.
- **Request:** `{ text: string (max length enforced, e.g. 20,000 chars) }`.
- **Validation:** reject empty/whitespace-only input (`422`); enforce max length server-side regardless of any client-side limit.
- **Response:** `{ result: 'unicode' | 'legacy_krutidev' | 'unknown' }` — `'unknown'` is a valid, expected outcome, not an error (see [AI_RULES.md](AI_RULES.md): never guess).
- **Credit behavior:** none — free, not logged to `tool_usage` (see [PRD.md](PRD.md) § 7).

### `convertHindiText({ text, direction })` — Hindi Converter
- **Purpose:** run Kruti Dev ↔ Unicode conversion and settle credits.
- **Auth:** required.
- **Authz:** own action only.
- **Request:** `{ text: string (max length enforced), direction: 'kruti_to_unicode' | 'unicode_to_kruti' }`.
- **Validation:** reject empty input (`422`); reject unsupported `direction` values; server re-validates the input roughly matches the claimed source encoding using the same detection logic as `detectTextEncoding` — if it clearly doesn't (e.g. `direction: 'kruti_to_unicode'` on text that's already Devanagari Unicode with no legacy glyph codes), respond `422` rather than silently producing garbage output that still costs a credit.
- **Response (success):** `{ success: true, convertedText: string, newBalance: number, creditsCharged: number }`.
- **Response (conversion engine cannot process, e.g. contains unmapped glyphs):** `{ success: false, error: 'unmapped_characters', details: [...] }` — this is a **failure**, not charged.
- **Errors:** `401` · `402` insufficient credits · `422` invalid input/direction.
- **Credit behavior:** debits `tool_pricing.cost_credits.hindi_converter` only on `success: true`. Conversion, `tool_usage` insert, and debit happen in one server-side call — no separate client-reported "it worked" step (unlike the image tools), because the server itself performed the conversion and knows definitively whether it succeeded.

## 5. Payments

### `getCreditPacks()`
- **Purpose:** list purchasable packs for the buy-credits UI.
- **Auth:** required.
- **Authz:** none beyond auth.
- **Response:** `pricing_plans` rows where `active = true`.

### `submitUtrPayment({ pricingPlanId, utr })`
- **Purpose:** record a manual UPI payment claim for admin review.
- **Auth:** required.
- **Authz:** creates a row owned by the caller only.
- **Request:** `{ pricingPlanId: uuid, utr: string }`.
- **Validation:** `pricingPlanId` must reference an active `pricing_plans` row (server looks up `amount_inr`/`credits` from it — never accepts these as client input); `utr` format-checked (typical UPI UTR is a 12-digit numeric reference — validate pattern, don't over-trust it); reject if `utr` already exists in `payments` (`409`, the unique constraint is the backstop, but check first for a clean error message).
- **Response:** `{ paymentId: uuid, status: 'pending' }`.
- **Errors:** `401` · `404` invalid/inactive pack · `409` duplicate UTR · `422` malformed UTR.
- **Credit behavior:** none yet — `payments` row created `status='pending'`; no `credit_transactions` row until admin approval.

### `getMyPayments()`
- **Purpose:** user's own payment history/status.
- **Auth:** required.
- **Authz:** own rows only.
- **Response:** `payments[]` for the caller.

## 6. Admin Operations

Every action below additionally requires `EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())`, checked server-side before any other logic runs (§ SECURITY.md § Admin Authorization). RLS also blocks non-admins at the DB layer as a second line of defense.

### `adminListUsers({ search, page, pageSize })`
- **Purpose:** search/browse users.
- **Auth:** required. **Authz:** admin only.
- **Request:** `{ search?: string (matches name/email/phone), page, pageSize (max 100) }`.
- **Response:** `{ items: ProfileWithBalance[], total }`.
- **Credit behavior:** read-only.

### `adminGetUser({ userId })`
- **Purpose:** single user detail view (profile, balance, recent transactions, recent tool usage, recent payments).
- **Auth:** required. **Authz:** admin only.
- **Errors:** `404` if `userId` doesn't exist.

### `adminAdjustCredits({ userId, amount, reason })`
- **Purpose:** manual credit add/remove.
- **Auth:** required. **Authz:** admin only.
- **Request:** `{ userId: uuid, amount: integer (nonzero, positive=add negative=remove), reason: string (required, min length e.g. 3) }`.
- **Validation:** `amount = 0` rejected (`422`); `reason` required — no anonymous/unexplained adjustments (audit requirement); if `amount < 0`, server checks resulting balance won't go negative (`402` if it would).
- **Response:** `{ newBalance: number, transactionId: uuid }`.
- **Errors:** `401` · `403` not admin · `404` user not found · `402` would go negative · `422` missing reason/zero amount.
- **Credit behavior:** always creates a `credit_transactions` row with `created_by = adminId`, `reason` = admin-supplied text, in the same transaction as the `credits.balance` update.

### `adminListPendingPayments({ page, pageSize })`
- **Purpose:** admin approval queue.
- **Auth:** required. **Authz:** admin only.
- **Response:** `payments` where `status = 'pending'`, oldest first.

### `adminApprovePayment({ paymentId })`
- **Purpose:** approve a UTR submission, granting credits.
- **Auth:** required. **Authz:** admin only.
- **Request:** `{ paymentId: uuid }`.
- **Validation:** the underlying update is `UPDATE payments SET status='approved', reviewed_by=$admin, reviewed_at=now() WHERE id=$paymentId AND status='pending'` — if 0 rows affected (already approved/rejected, or concurrent double-click), the action returns a `409` and performs **no** credit mutation. This is the idempotency guard against duplicate approval / payment replay.
- **Response:** `{ success: true, newBalance: number, creditsGranted: number }` or `409` conflict.
- **Credit behavior:** on success, credits `payments.credits_requested` to the payment's `user_id`, inserts `credit_transactions` (`reason='payment_approved'`, `reference=payments.id`), all in one transaction with the status update.

### `adminRejectPayment({ paymentId, reason })`
- **Purpose:** reject a UTR submission.
- **Auth:** required. **Authz:** admin only.
- **Request:** `{ paymentId: uuid, reason: string (required) }`.
- **Validation:** same `status='pending'` guard as approval — rejecting an already-decided payment returns `409`.
- **Credit behavior:** none — no `credit_transactions` row is ever created for a rejection.

### `adminGetToolUsageStats()`
- **Purpose:** "basic tool-usage count" (brief § 7).
- **Auth:** required. **Authz:** admin only.
- **Response:** `{ tool, successCount, failedCount }[]` — simple `GROUP BY tool, status` aggregate, no analytics dashboard (explicitly out of scope, brief § 11).

## 7. Tool Usage (read)

### `getMyToolUsage({ page, pageSize })`
- **Purpose:** user-facing "your recent tool activity."
- **Auth:** required. **Authz:** own rows only.
- **Response:** `tool_usage[]` for the caller.

## Error shape convention

All actions return either the typed success payload or `{ success: false, code: string, message: string }` with an HTTP-equivalent status mapped in Server Action error handling — `401` unauthenticated, `402` insufficient credits / balance guard, `403` unauthorized (not admin), `404` not found, `409` conflict (duplicate/already-decided), `422` validation failure, `500` unexpected server error (never leaks internals — see [SECURITY.md](SECURITY.md) § Error Handling).
