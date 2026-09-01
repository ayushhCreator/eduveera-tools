# Eduveera Tools — Security

**Assume every frontend request can be manipulated.** Every rule below treats client input — including "this succeeded, charge me the credit," any user id, any amount, any file's declared MIME type — as untrusted until validated server-side.

## 1. Authentication

- Supabase Auth is the sole identity provider (email/password; magic link optional). No custom password handling in application code.
- Sessions via `@supabase/ssr` cookie-based auth — httpOnly, secure cookies; no JWT stored in localStorage/sessionStorage (avoids XSS-driven session theft).
- Every Server Action starts by calling `supabase.auth.getUser()` server-side and deriving the acting user id from the returned session — **never** from a request body field like `userId`. A request body `userId` field, if present anywhere, is ignored for authorization purposes.

## 2. Admin Authorization

- Defense in depth, two independent layers, both required:
  1. **Application layer:** every admin Server Action explicitly queries `admin_users` for the authenticated user id before doing anything else. Missing/failed check → `403`, no further logic runs.
  2. **Database layer:** RLS policies on admin-only tables/operations also check `admin_users` membership, so even a bug that skips the application-layer check (or a direct DB access path) is still blocked.
- No self-serve admin signup. Admin rows are provisioned out-of-band (Supabase SQL editor / a one-off maintenance script run by someone with project access) — never via an application endpoint.
- `/admin/*` route-level redirect for non-admins is UX only, not a security boundary — do not rely on it alone.

## 3. Supabase Row Level Security (RLS)

RLS enabled on every table, no exceptions, default-deny.

| Table | User (own row) | Admin | Anonymous |
|---|---|---|---|
| `profiles` | SELECT/UPDATE own | SELECT all | none |
| `credits` | SELECT own | SELECT all | none |
| `credit_transactions` | SELECT own | SELECT all | none |
| `payments` | SELECT/INSERT own | SELECT/UPDATE all | none |
| `tool_usage` | SELECT own | SELECT all | none |
| `admin_users` | none | SELECT own membership | none |
| `pricing_plans`, `tool_pricing` | SELECT (active only) | SELECT/UPDATE all | none |

**Critical:** no role — including the authenticated user themselves — has direct `INSERT`/`UPDATE` RLS grant on `credits` or `credit_transactions`. Those tables are only ever written via `SECURITY DEFINER` Postgres functions invoked from server-side code using the service role, or via server-side calls that run as the service role — the anon/authenticated Postgres roles have no write grant on them at all. This makes "client forges a request to bump their own balance" impossible even if application-layer bugs existed, because Postgres itself refuses the write.

## 4. Service-Role Key Protection

- `SUPABASE_SERVICE_ROLE_KEY` exists only in server-side environment variables (Vercel project env, never `NEXT_PUBLIC_*`). It is never sent to the client, never logged, never included in error messages or stack traces returned to the browser.
- Server Actions run server-side by definition (Next.js enforces this — client bundles cannot reference server-action modules that import the service-role client), but code review must still confirm no service-role client is ever instantiated in a file reachable from client components.
- Local dev: service key lives in `.env.local`, which is git-ignored (see [DEPLOYMENT.md](DEPLOYMENT.md) § Secrets).

## 5. Credit Manipulation

- All three credit-mutating operations (tool debit, payment approval credit, admin adjustment) are server-side-only, amount-derived-server-side (never client-supplied), and detailed in [API.md](API.md) / [ARCHITECTURE.md](ARCHITECTURE.md) § 6.
- `credits.balance >= 0` DB check constraint is a hard backstop even if application logic has a bug.
- Image/Passport tool "success" claims from the client go through a server-side plausibility check before being trusted (§ ARCHITECTURE.md § 6) — this bounds, but does not eliminate, the risk of a manipulated client claiming false success. Accepted trade-off for MVP budget; documented, not hidden.

## 6. Race Conditions

- Concurrent requests against the same user's `credits` row (e.g. two tool actions fired back-to-back, or a tool debit racing an admin adjustment) are serialized via row-level locking (`SELECT ... FOR UPDATE` on the `credits` row, or an equivalent `SERIALIZABLE` transaction) inside the same DB transaction that checks balance sufficiency and writes the debit — so two concurrent debits can never both pass a stale "balance is sufficient" check and jointly overdraw.
- Admin approving the same payment from two browser tabs: handled by the `payments.status='pending'` guarded update (§ 7 below), not by locking — the second request simply affects 0 rows.

## 7. Duplicate Transactions / Payment Replay / UTR Approval

- `payments.utr` has a **unique** constraint — the same UTR cannot be submitted twice, at the database level, regardless of application-layer checks.
- Approval is idempotent by construction: `UPDATE payments SET status='approved', ... WHERE id=$id AND status='pending'`. A retried request, a double-click, or a race between two admin sessions all resolve to "first one wins, rest get 0 rows affected → `409`, no second credit grant."
- Credits are granted **only** inside that same guarded update's transaction — never speculatively, never before the status flip is confirmed.
- Rejected payments can never later be silently re-approved to grant credits without a fresh admin action against a still-`pending` row — since the row is no longer `pending`, the guard blocks it. Reopening a rejected payment (if ever needed) would be a distinct, explicit admin action, not built for MVP.

## 8. File Uploads

- Accepted only for Image Compressor and Passport Photo, both processed client-side (§ ARCHITECTURE.md § 9) — the common path never uploads the original file to the server at all, which is itself a strong mitigation (nothing to attack server-side because nothing arrives server-side).
- If any server-side file handling is added later, minimum bar: server-side MIME sniffing (not trusting the browser-reported `Content-Type` or file extension), a strict allow-list (`image/jpeg`, `image/png`, `image/webp`), a hard size cap (e.g. 15 MB) enforced before any processing begins, and files never written to a publicly-readable path.

## 9. MIME Validation

- Client-side `accept` attribute and `File.type` checks are UX only, not security — they are trivially spoofable.
- Any code path that does touch a file server-side must verify actual file content (magic-byte/signature check), not just the declared MIME type or extension.

## 10. File-Size Limits

- Enforced client-side for immediate feedback and server-side (if a server path exists) as the real limit. Recommended cap: 15 MB per upload — well above what's needed for a compressible photo, low enough to prevent trivial resource-exhaustion via oversized uploads. **[Technical Recommendation — confirm with client if a different limit is preferred.]**

## 11. XSS

- React/Next.js auto-escapes rendered text by default — no `dangerouslySetInnerHTML` anywhere near user-supplied content (pasted Hindi text, names, UTR strings, admin `reason` fields).
- Converted Hindi text is rendered as plain text/`value` in a textarea or escaped `<pre>`/text node — never interpreted as HTML.
- Content-Security-Policy header set at the Next.js/Vercel level restricting script sources to self.

## 12. CSRF

- Next.js Server Actions include built-in CSRF protection (same-origin check on the action's encrypted reference) — no additional custom CSRF token needed for Server Action calls.
- If any traditional `app/api/*` Route Handler is added (e.g. a future Razorpay webhook), it is exempted from session-based auth entirely (webhooks authenticate via signature verification, not cookies) and does not accept session-cookie-authenticated state-changing requests without its own signature check.

## 13. SQL Injection

- All database access goes through the Supabase JS client (parameterized queries) or Postgres functions with typed parameters — no raw string-concatenated SQL anywhere in application code.

## 14. Rate Limiting

- Applied at minimum to: `submitUtrPayment` (prevent UTR brute-force/spam), `detectTextEncoding` / `convertHindiText` (prevent using the free/paid text endpoints as a scraping or DoS vector), and auth endpoints (Supabase Auth has built-in rate limits; verify defaults are enabled).
- **[Technical Recommendation]** Implement via Vercel/Next.js middleware with a simple per-user (or per-IP for pre-auth) sliding-window counter — no need for a dedicated rate-limiting service at this scale/budget.

## 15. Privacy

- Do not retain uploaded photos/documents unnecessarily (brief § 10): the client-side processing architecture (§ ARCHITECTURE.md § 9) means originals typically never reach the server. If any server-side storage is ever used, it must use short-lived signed URLs and scheduled deletion — never a public bucket.
- Hindi conversion text is processed and returned; not persisted beyond what's needed for the response (no logging of full pasted text content in application logs — metadata like character count is fine, raw text is not).
- `tool_usage.metadata` must never contain file contents or full converted text — only small structured metadata (sizes, presets, direction).

## 16. Error Handling

- User-facing errors are specific enough to act on ("insufficient credits," "invalid UTR format") but never leak internals: no stack traces, no raw DB error messages, no service-role details in any response body sent to the browser.
- Server-side logging (Vercel logs) can be more detailed than client-facing errors, but must still never log the service-role key, full Supabase connection strings, or full user-pasted document text.

## 17. Secrets

- `SUPABASE_SERVICE_ROLE_KEY`, any future Razorpay API secret/webhook signing secret: server-side env vars only, set in Vercel project settings per environment (dev/preview/production), never committed to git, never in `NEXT_PUBLIC_*`.
- `.env.local` (and any `.env*` except `.env.example`) is git-ignored from day one.
- Full inventory and rotation guidance: [DEPLOYMENT.md](DEPLOYMENT.md) § Secrets.
