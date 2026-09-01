# Eduveera Tools — Architecture

Stack (mandated): Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Postgres + Auth), Vercel, GitHub.

**Single monolithic Next.js app.** No microservices, no separate backend service. All "backend" logic is Next.js Server Actions / Route Handlers running against Supabase Postgres. This matches the brief's budget (~₹2,000–₹3,000) and scope — a distributed system would be pure over-engineering here.

## 1. Frontend Architecture

- Next.js App Router, TypeScript throughout.
- Tailwind + shadcn/ui for all UI — no separate design system, no CSS-in-JS library.
- Route layout:
  - `/` — landing, tool cards (brief § 9: "clear tool cards/buttons").
  - `/tools/image-compressor`, `/tools/passport-photo`, `/tools/hindi-converter` — one page per tool, each a thin client component driving one server action.
  - `/dashboard` — credit balance, transaction history, tool usage history, buy-credits.
  - `/admin/*` — admin panel, gated (§ 5 below).
  - `/login`, `/signup` — Supabase Auth UI.
- Mobile-first Tailwind breakpoints; every tool page tested at mobile viewport first (brief explicitly calls this out for Image Compressor, and it's a general MVP requirement).
- Bilingual labels (Hindi + English) as static UI strings — not a full i18n framework; that's out of scope (brief § 11: "multi-language expansion beyond the agreed UI").

## 2. Backend Architecture

- Next.js Server Actions are the primary "API." Route Handlers (`app/api/*`) used only where a plain HTTP endpoint is required (e.g. a future Razorpay webhook receiver, which needs a stable URL outside the Server Action RPC mechanism).
- All credit-affecting logic runs server-side only — see § 6.
- No queues, no background workers, no separate services. Image/photo processing and Hindi conversion both complete within a single request lifecycle (see § 8, § 9).

## 3. Database Architecture

Supabase-hosted Postgres. Schema, indexes, and constraints: [DATABASE.md](DATABASE.md). Key architectural decisions:
- Credit ledger (`credit_transactions`) is append-only; `credits.balance` is a derived-but-cached value kept in sync only via server-side transactional functions (never direct client writes).
- Migrations tracked in `supabase/migrations/` and applied via Supabase CLI — see [DEPLOYMENT.md](DEPLOYMENT.md).

## 4. Authentication

- **Supabase Auth** (email/password, and optionally magic link — brief doesn't mandate a specific auth method beyond "admin login" and implied user accounts for credit ownership).
- Session handled via `@supabase/ssr` cookie-based sessions in the Next.js app (server components and server actions read the authenticated user from the request, never from a client-supplied user id).
- On signup, a Postgres trigger creates the matching `profiles` and `credits` rows (§ DATABASE.md) — the application never manually inserts these, eliminating a class of "user exists but has no credit row" bugs.

## 5. Authorization

Two tiers:

1. **User-level:** every Server Action that touches user data re-derives the user id from the authenticated session server-side (`supabase.auth.getUser()`), never from a request parameter. A user can only ever act on their own rows.
2. **Admin-level:** every admin Server Action checks membership in `admin_users` server-side before doing anything, in addition to Supabase RLS also enforcing it at the database layer (defense in depth — see [SECURITY.md](SECURITY.md) § Admin Authorization). The `/admin/*` route tree also does a server-side redirect for non-admins, but that's UX, not the security boundary — the real boundary is the Server Action check + RLS.

## 6. Credit Architecture

This is the highest-scrutiny non-Hindi part of the system; assume every client request can be forged (brief § 10, and general security posture — see [SECURITY.md](SECURITY.md)).

**Rule:** credits never change as a side effect of a client-trusted value. Every credit mutation is one of exactly three server-side operations (detailed transactionally in [DATABASE.md](DATABASE.md) § Transaction requirements):

1. **Tool-usage debit** — triggered only after a Server Action independently determines the action succeeded (§ 8/9 below), reads the cost from `tool_pricing` server-side, checks sufficient balance, then atomically debits + logs.
2. **Payment approval credit** — triggered only by an admin Server Action, guarded against double-approval by the `payments.status = 'pending'` transition guard.
3. **Admin manual adjustment** — triggered only by an admin Server Action, always requires a `reason`.

No Server Action ever accepts a `newBalance`, `amount`, or `creditsToAdd` parameter from the client for these operations — amounts are always looked up server-side (`tool_pricing`, `pricing_plans`) or entered by an authenticated admin and logged with `created_by`.

**Client-side-processing vs. server-side-gating tension:** the brief asks for client-side image processing ("prefer client-side processing where practical") *and* server-side-only credit changes on successful actions. Resolution **[Technical Recommendation]** — **gate-then-run**:
- Before the client is allowed to start processing (before "Compress"/"Generate" is even clickable), the tool page calls `getCreditBalance()` + `getToolPricing()` and blocks with an "insufficient credits" state if `balance < cost`. This is the real gate: it fires **before** any work happens or any output exists, so a zero-balance user never gets a usable download to begin with — matching the brief's intent that a successful action requires credits, not just that it gets billed for one.
- Only once the pre-flight gate passes does the client do the actual pixel work in the browser (fast, no upload of large files needed) via Canvas/WASM.
- The client then calls a Server Action (`recordToolResult`) that receives only small, cheap-to-sanity-check output metadata (e.g. final file size in KB, target preset). The server re-checks balance (covering the rare race where it changed between the pre-flight gate and completion — e.g. a concurrent debit elsewhere), applies a plausibility check on the claimed result (e.g. final size actually ≤ target, dimensions in expected range), and only then debits credits + writes `tool_usage`. This remains the *authoritative* enforcement point; the pre-flight gate is a UX/abuse-reduction measure, not a substitute for it.
- Residual gap, accepted for this budget: a devtools-savvy user can still extract the in-memory processed blob after the gate passes but before/without calling `recordToolResult`, dodging the charge. Not defensible against a determined attacker — appropriate trade-off for a low-value credit system at this budget, not silently ignored. If this becomes a real problem, the fix is moving compression server-side (future consideration, not built now).
- Hindi Converter conversion runs the mapping/reordering logic **server-side** (text is small, this makes the server the sole source of truth for the result, and avoids shipping mapping tables to the client) — so its debit follows the simpler "server computed it, server knows it succeeded" path with no gate-ordering or plausibility-check gap: the balance check, conversion, and debit all happen in one server-side call before any result is returned to the client.

## 7. Payment Architecture

- MVP: manual UPI + UTR, matching brief § 6's explicit fallback ("if integration delays the MVP, use manual UPI + UTR approval first").
- Flow: user picks a `pricing_plans` row → submits UTR → `payments` row created `status='pending'` → admin approves/rejects via Server Action → approval atomically credits + logs (§ 6, item 2).
- Duplicate/replay defense: `payments.utr` has a unique constraint (can't submit the same UTR twice); approval is idempotent via the `pending`-guarded status transition (can't double-credit one approval click or a race between two admin sessions). Detail: [SECURITY.md](SECURITY.md) § Payment Replay.
- **Future:** Razorpay (or similar) integration replaces manual UTR entry with a hosted checkout + webhook that writes `payments.gateway_payment_id` and flips status automatically after signature verification. The `payments` table already has the columns for this so the migration is additive, not a redesign.

## 8. Hindi Conversion Architecture

The highest-risk component (brief § 2: "MOST IMPORTANT"). Architecture, not implementation — **no mapping table data exists yet** (see [AI_RULES.md](AI_RULES.md) and [TODO.md](TODO.md)).

```
lib/hindi/
  ├── detect.ts            # Smart Detection: classify input as 'unicode' | legacy font id | 'unknown'
  ├── mappings/
  │     ├── krutidev.ts     # glyph-code ↔ Unicode codepoint table for Kruti Dev (data module)
  │     └── <future-font>.ts
  ├── reorder.ts            # matra/conjunct reordering rules (legacy fonts store visual order,
  │                          # Unicode needs logical order — this is a separate concern from
  │                          # character mapping and must not be baked into the mapping tables)
  ├── convert.ts            # orchestrator: detect → pick mapping module → map chars → apply
  │                          # reordering rules in the correct direction → return result
  └── __tests__/
        ├── golden-corpus/   # see TESTING.md
        └── ...
```

Design rules (enforced in [AI_RULES.md](AI_RULES.md)):
- **Mapping data and reordering rules are separate modules from the conversion orchestrator.** Adding a new legacy font is "add a new file under `mappings/`," never "edit the orchestrator's logic."
- `detect.ts` only recognizes patterns it has verified data for. Anything else returns `'unknown'` — it never falls back to guessing that unrecognized ASCII is Kruti Dev.
- Every mapping table ships with a matching entry in the golden test corpus (TESTING.md) before it's considered usable.
- Runs server-side (§ 6) — client sends raw pasted text, server returns converted text. Mapping tables are not required to stay secret, but keeping conversion server-side keeps the client thin and keeps one authoritative implementation.

## 9. File Processing Architecture

- **Image Compressor / Passport Photo:** client-side transform (Canvas API, or a lightweight WASM codec if the browser Canvas output can't reliably hit small KB targets) — no original image upload required for the common path, which also minimizes what touches the server for privacy (brief § 10: "do not retain photos/documents unnecessarily").
- Nothing is written to Supabase Storage by default for the MVP happy path — files are processed and downloaded directly in-browser. If a server-side fallback or admin-visible preview is ever needed, it must go through Supabase Storage with short-lived signed URLs and a scheduled deletion — never a public bucket. Not built for MVP unless a Day-1 requirement forces it.
- MIME/type/size validation happens both client-side (fast UX feedback) and server-side in `recordToolResult` (never trust client validation alone) — detail in [SECURITY.md](SECURITY.md).

## 10. Deployment Architecture

- GitHub repo → Vercel (build + hosting + preview deployments per PR) → Supabase (managed Postgres + Auth).
- Full detail, environment variables, and rollback strategy: [DEPLOYMENT.md](DEPLOYMENT.md).

## Architecture diagram

```
Browser (Next.js client components)
  │  Canvas/WASM image work            │  paste text
  ▼                                    ▼
Server Actions (Next.js, runs on Vercel)
  │  auth.getUser() — session-derived, never client-supplied
  │  admin_users check for /admin actions
  │  tool_pricing / pricing_plans lookups (server-side only)
  │  Hindi mapping + reordering (lib/hindi/*)
  │  credit debit/credit transactional functions
  ▼
Supabase Postgres  (RLS + service-role-only writes to credits/credit_transactions)
Supabase Auth      (sessions, user identity)
```
