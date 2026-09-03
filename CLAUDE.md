# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout note

This repo (`eduveera-tools/`) is the Next.js app root — `package.json`, `git`, and this
file all live here. It sits inside a parent dir (`The_Base/Eduveera/`) that holds nothing
else but a `.claude/` config; a session may open with the parent as the working
directory, so run commands from `eduveera-tools/` (or `npm --prefix eduveera-tools …`).

App code is under **`src/`** (`src/app`, `src/lib`, `src/components`). Routes are flat
under `src/app` (no route groups). `src/app/api` is reserved for a future payment webhook
and is currently empty. All engineering docs are under **`docs/`**.

## Commands

```bash
npm run dev          # dev server on :3000
npm run build        # production build
npm run lint         # eslint (flat config, eslint-config-next)
npm run typecheck    # tsc --noEmit
npm test             # vitest run — unit + integration (jsdom, "@/" -> src/)
npm run test:watch   # vitest watch
npm run test:e2e     # playwright — builds+starts the app, runs desktop + mobile projects
npm run db:test      # DB verification: throwaway postgres:16 in Docker, applies
                     # migrations, asserts schema/RLS/credit-fns + a concurrent-debit race
```

- Single unit test: `npx vitest run src/lib/hindi/convert.test.ts` or `npx vitest run -t "<name>"`
- Single e2e spec: `npx playwright test e2e/auth.spec.ts`
- E2E needs a reachable Supabase Auth instance — run `npx supabase start` first (spins up
  local Postgres/Auth via Docker, auto-applies `supabase/migrations/`, prints URL + keys
  for `.env.local`). `npx supabase stop` when done.
- Pre-commit green check: `npm run typecheck && npm run lint && npm test && npm run build`

## Architecture

Single monolithic Next.js App Router app — no separate backend, no microservices, no
queues/workers. "Backend" = Server Actions in `src/lib/*/actions.ts` running against
Supabase Postgres. Stack is mandated (Next.js, TS, Tailwind v4, shadcn/ui in
`src/components/ui`, Supabase, Vercel); don't introduce new frameworks/services/DBs.

### Credit system — the core invariant

`credits.balance` and `credit_transactions` change **only** through the four
`SECURITY DEFINER` Postgres functions in `supabase/migrations/0004_credit_functions.sql`
(`settle_tool_usage`, `approve_payment`, `reject_payment`, `admin_adjust_credits`).
`EXECUTE` is granted to `service_role` only; they're called exclusively from
`src/lib/credits/actions.ts` via `createServiceRoleClient()`.

- Never write the balance from the client, never from a non-service-role path, never
  trust a client-supplied amount. Costs are read server-side from `tool_pricing` /
  `pricing_plans`.
- Every balance change writes a matching `credit_transactions` row in the same DB
  transaction. A failed tool run charges 0 and creates no transaction row.
- Server Action results use the `ActionResult<T>` discriminated union
  (`src/lib/credits/errors.ts`); callers branch on `success`, not try/catch. Each
  `raise exception '<key>'` in migration 0004 must have a matching entry in
  `PG_ERROR_CODES` (`mapPostgresError`) or it silently degrades to `INTERNAL`.

### Auth / authz

- Caller identity comes only from `src/lib/auth/session.ts`
  (`getCurrentUser` / `requireUser` / `requireAdmin`) — derived from the session cookie
  via `supabase.auth.getUser()`, never from a request parameter.
- Admin actions check `admin_users` membership **server-side in the action itself**, in
  addition to RLS enforcing it at the DB. The `src/middleware.ts` redirect for
  `/dashboard|/tools|/admin` is UX only, not the security boundary.
- Three Supabase clients: `src/lib/supabase/browser.ts`, `server.ts` (RLS-scoped, cookie
  session — default for reads), `service-role.ts` (bypasses RLS — credit mutations only).

### Hindi converter — highest-risk component

Read `docs/AI_RULES.md` rules 9–12 and `docs/ARCHITECTURE.md` § 8 before touching this.

- **Never fabricate or guess** Kruti Dev ↔ Unicode glyph mappings or reordering rules.
- Mapping data lives in self-contained modules under `src/lib/hindi/mappings/`, registered
  in `MAPPING_REGISTRY` in `src/lib/hindi/convert.ts`. The orchestrator holds no mapping
  data. A `MappingModule` owns its entire text transform (substitution + reordering are
  interleaved and direction-dependent). Adding a font = new module + registry entry, never
  editing orchestration logic.
- `src/lib/hindi/detect.ts` recognizes only verified patterns; unknown input returns
  `'unknown'`, never a best-effort guess. Detects Unicode Devanagari **and** legacy Kruti
  Dev (signature = any CP1252 extended byte that appears in `KRUTI_TO_UNICODE_TABLE`);
  pure-ASCII Kruti Dev stays `'unknown'` (indistinguishable from English).
- Conversion runs fully server-side (`convertHindiText` in `src/lib/hindi/actions.ts`):
  computes the result and settles the credit in one call, unlike the image tools.
- Every reported conversion bug gets a golden-corpus pair
  (`NN-category.legacy.txt` + `.unicode.txt`) under
  `src/lib/hindi/__tests__/golden-corpus/krutidev/` before or with the fix; runs via
  `krutidev.test.ts`.
- Source attribution: `src/lib/hindi/mappings/krutidev.ts` header + `mappings/README.md`.
  Accepted risk (user decision 2026-09-02): the TGNYC source has no license file — don't
  re-raise. One documented mapping disagreement at byte 211 is left as-is, not guessed.

### Image Compressor / Passport Photo — gate-then-run

1. Client pre-flight (`getCreditBalance` + `getToolPricing`) blocks the process button
   when `balance < cost`. This is UX / abuse reduction, **not** the security boundary.
2. Pixel work happens client-side (Canvas) — no upload of the original on the happy path.
3. The client calls a settle Server Action (`recordToolResult` / `settleToolUsage`) which
   re-checks balance and plausibility-checks the claimed result (final size ≤ target,
   dimensions in range) — this is the authoritative debit point.
4. Accepted residual gap: a user can extract the in-memory processed blob before calling
   the settle action and dodge the charge. Acceptable at this budget; the fix (server-side
   compression) is not built.

Nothing is written to Supabase Storage. If server-side file handling is ever added: short-
lived signed URLs + scheduled deletion, never a public bucket.

### Database

8 tables: `profiles`, `credits`, `credit_transactions`, `payments`, `tool_usage`,
`admin_users`, `pricing_plans`, `tool_pricing` (full schema in `docs/DATABASE.md`).

- Migrations are ordered `NNNN_name.sql` in `supabase/migrations/`, auto-applied by
  `supabase start` and `npm run db:test`. The signup trigger (`0002`) auto-creates
  `profiles` + `credits` rows — the app never inserts them.
- RLS is default-deny on every table; no client write grant on `credits` /
  `credit_transactions`.
- Payment replay defense: `payments.utr` is unique; `approve_payment` is idempotent via a
  `where status = 'pending'` guard (double-click / concurrent-admin safe).

## Documentation is load-bearing — keep it in sync

- `docs/AI_RULES.md` governs and overrides convenience. Read it before touching credits or
  Hindi conversion.
- `docs/PRD.md` is the product source of truth (derived from
  `docs/Eduveera_Developer_Final_MVP_Brief_v2.pdf`). Don't invent requirements or add
  explicit non-goals: native mobile apps, advanced PDF editor, AI face detection / bg
  removal, large-scale analytics, referral/affiliate system, subscription billing.
- `docs/STATUS.md` and `docs/TODO.md` are the current-state / what's-left snapshot. **Trust these
  over inline code comments** — some comments are stale (e.g. `src/lib/hindi/actions.ts`
  says `convertText` always returns `ok: false`; it doesn't anymore — `krutidev` is
  registered).
- When a brief requirement conflicts with an implementation shortcut, follow the
  resolution already written in `docs/ARCHITECTURE.md`; if it's a new conflict, document the
  resolution there the same way rather than deciding ad hoc.
- `docs/API.md` documents every Server Action; `docs/SECURITY.md` is the threat model; `docs/TESTING.md`
  covers the golden-corpus process; `docs/DEPLOYMENT.md` covers environments, prod migrations,
  and rollback.

## Environment variables

| Variable | Exposure | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | RLS is the real access control |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret, server-only** | bypasses RLS; never prefix `NEXT_PUBLIC_` |

`.env.example` → `.env.local`. Razorpay keys are reserved for a future gateway, unused in
the MVP.

## CI

`.github/workflows/ci.yml`: `lint-typecheck-test-build` (build runs with placeholder
Supabase env vars) + `db-schema` (`npm run db:test`). The Playwright E2E job is written
but commented out — it needs Supabase credentials reachable from GitHub Actions.

## Known accepted limitations (check docs/STATUS.md before "fixing")

- Rate limiter (`src/lib/security/rate-limit.ts`) is in-memory / single-instance — fine
  for one Vercel instance, needs a shared store before scaling out.
- Credit pricing values (M4) and UPI payee details (M5) are functional placeholders
  pending client-confirmed numbers.
- Passport Photo crop/zoom/reposition has no full interactive E2E (`react-easy-crop`
  pointer-drag doesn't simulate headlessly) — covered by unit tests on the crop math.
