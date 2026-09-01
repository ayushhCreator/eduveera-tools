# Eduveera Tools — Development Roadmap

Phased for an AI coding agent to execute in order. Each task lists objective, dependencies, expected output, and required tests. Cross-references: [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [API.md](API.md), [SECURITY.md](SECURITY.md), [AI_RULES.md](AI_RULES.md), [TESTING.md](TESTING.md), [DEPLOYMENT.md](DEPLOYMENT.md).

## Blocking missing inputs (resolve before the phases that need them)

- **M1 — Kruti Dev mapping table + reordering rules.** No mapping data exists in the brief. Required before Phase 9. Get from client/domain source; do not fabricate (AI_RULES.md rule 9).
- **M2 — Real deed sample text.** No samples in the brief. Required before Phase 9–11 can be considered done (acceptance criteria explicitly requires this). Must be reviewed for PII before entering the repo (TESTING.md § 6).
- **M3 — Passport photo dimensions/DPI.** Brief says "fixed passport-style" with no numbers. Required before Phase 7. Confirm with client; until then, implement behind a config constant with an obvious placeholder value (e.g. standard Indian passport photo 35mm×45mm / 413×531px @ 300 DPI) clearly marked as unconfirmed.
- **M4 — Credit pricing values** (per-tool cost, ₹-to-credit pack amounts). Brief says "configurable," gives no numbers. Required before Phase 13 launch-readiness (not before building the mechanism — the mechanism just needs to read from config, values can be placeholder until confirmed).
- **M5 — UPI payee details** (VPA / QR / display name) for the manual payment instructions shown to users. Required before Phase 13 launch-readiness.

## Phase 1 — Project Setup

**Objective:** working Next.js + TypeScript + Tailwind + shadcn/ui skeleton, deployed and reachable.
**Dependencies:** none.
**Expected output:** repo scaffolded (`create-next-app` with TS + Tailwind), shadcn/ui initialized, GitHub repo created, connected to Vercel with a working "hello world" deploy at a preview and production URL, `.env.example` created, `.gitignore` covers `.env*`.
**Tests required:** CI runs `npm run build` and `npm run lint` on PR (basic pipeline, nothing app-specific yet).

## Phase 2 — Database

**Objective:** full schema from [DATABASE.md](DATABASE.md) live in a Supabase project via migrations.
**Dependencies:** Phase 1.
**Expected output:** `supabase/migrations/` containing tables `profiles`, `credits`, `credit_transactions`, `payments`, `tool_usage`, `admin_users`, `pricing_plans`, `tool_pricing` with all columns/constraints/indexes specified; the `auth.users` → `profiles`+`credits` trigger; RLS enabled on every table with the policies from [SECURITY.md](SECURITY.md) § 3 (default-deny, no client write grant on `credits`/`credit_transactions`).
**Tests required:** integration test confirming the signup trigger creates `profiles`+`credits` rows; integration test confirming an authenticated (non-service-role) client cannot `INSERT`/`UPDATE` `credits` or `credit_transactions` directly (RLS + grant check per TESTING.md § 2).

## Phase 3 — Authentication

**Objective:** working signup/login/logout using Supabase Auth.
**Dependencies:** Phase 2.
**Expected output:** `/login`, `/signup` pages; `@supabase/ssr` session wiring for server components and Server Actions; `getSession()` helper; middleware or layout-level redirect for unauthenticated users on protected routes.
**Tests required:** E2E — sign up, land on dashboard with 0 balance; sign out, confirm protected routes redirect to `/login`.

## Phase 4 — Credit System (mechanism only, no UI yet)

**Objective:** the three server-side credit-mutating transactional functions, with no product UI calling them yet.
**Dependencies:** Phase 2, Phase 3.
**Expected output:** Postgres functions (or equivalent server-side transactional code) for (a) tool-usage debit, (b) payment-approval credit, (c) admin manual adjustment — each per the exact transaction shape in [DATABASE.md](DATABASE.md) § Transaction requirements and [API.md](API.md) §§ 4/5/6. `getCreditBalance`, `getMyTransactions` read actions.
**Tests required:** integration tests per TESTING.md § 2 — atomicity (balance always equals `SUM(credit_transactions.amount)`), race-condition test (concurrent debits can't overdraw, per SECURITY.md § 6), negative-balance check constraint fires correctly.

## Phase 5 — Dashboard

**Objective:** user-facing dashboard showing balance, transaction history, tool usage history, and entry points to tools.
**Dependencies:** Phase 3, Phase 4.
**Expected output:** `/dashboard` page: balance display, paginated `getMyTransactions` list, paginated `getMyToolUsage` list, tool cards linking to each tool page (brief § 9).
**Tests required:** E2E — dashboard reflects a balance change after a manual DB-level credit insert (sanity check the read path); mobile-viewport pass.

## Phase 6 — Image Compressor

**Objective:** working compressor per brief § 3.
**Dependencies:** Phase 4 (for the credit-settling step), Phase 1 (UI shell).
**Expected output:** `/tools/image-compressor` page: upload → pre-flight credit gate (`getCreditBalance`+`getToolPricing`, blocks processing if insufficient — API.md "Pre-flight gate") → preset selection (Under 100 KB / 50 KB / 30 KB / Custom) → client-side Canvas/WASM compression → shows original + final KB → download → calls `recordToolResult` (API.md § 4) to settle credits on success, log failure otherwise.
**Tests required:** E2E happy path (upload → compress → download → verify output ≤ target → balance decremented, per TESTING.md § 3); insufficient-balance test (gate blocks *before* processing starts, no output produced); plausibility-check rejection test (implausible claimed size → `422`, no debit); mobile E2E pass (brief explicitly requires mobile smoothness).

## Phase 7 — Passport Photo

**Objective:** working passport photo tool per brief § 4.
**Dependencies:** Phase 4, Phase 1, **M3 resolved** (or explicit placeholder dimension accepted for now).
**Expected output:** `/tools/passport-photo` page: upload → pre-flight credit gate (same pattern as Phase 6) → crop/zoom/reposition UI → fixed-ratio output → JPG download → `recordToolResult` settles credits. No AI background removal. Cropping component/config structured so a future A4 multi-copy sheet output can be added without redesigning the crop step (ARCHITECTURE.md § 9 / PRD.md § 6.2).
**Tests required:** E2E happy path (upload → crop → download → verify output dimensions/ratio match config → balance decremented); insufficient-balance gate test; mobile E2E pass (touch-based crop/zoom).

## Phase 8 — Hindi Conversion Infrastructure

**Objective:** the modular scaffolding from [ARCHITECTURE.md](ARCHITECTURE.md) § 8, with no real mapping data yet — infrastructure only.
**Dependencies:** Phase 1.
**Expected output:** `lib/hindi/` directory structure (`mappings/`, `reorder.ts`, `detect.ts`, `convert.ts`, `__tests__/golden-corpus/`); `convert.ts` orchestrator wired to accept a mapping module + reordering rules but with **no font mapping implemented yet** (throws/returns "unsupported" for everything until Phase 9 lands real data — do not stub with guessed data, per AI_RULES.md rule 9).
**Tests required:** unit test confirming the orchestrator correctly routes to a mock mapping module (proves the plumbing works) without asserting on any real Hindi correctness yet.

## Phase 9 — Kruti Dev → Unicode

**Objective:** real, verified Kruti Dev → Unicode conversion.
**Dependencies:** Phase 8, **M1 and M2 resolved** (this phase cannot start meaningfully without verified mapping data and real deed samples — blocked otherwise).
**Expected output:** `lib/hindi/mappings/krutidev.ts` populated with the verified glyph-code ↔ Unicode table; reordering rules for Kruti Dev's visual-order matra placement implemented in `reorder.ts`; `convert.ts` direction `kruti_to_unicode` fully working.
**Tests required:** full golden-corpus coverage per TESTING.md § 6 (matras, half letters, conjuncts, punctuation, numbers, mixed Hindi/English, real deed samples) for this direction, all passing in CI.

## Phase 10 — Unicode → Kruti Dev

**Objective:** the reverse direction.
**Dependencies:** Phase 9 (shares the mapping table; reordering logic for this direction is the inverse transform).
**Expected output:** `convert.ts` direction `unicode_to_kruti` fully working, reusing `krutidev.ts` and the reorder module.
**Tests required:** golden-corpus coverage for this direction (can largely reuse Phase 9's corpus pairs as round-trip tests, per TESTING.md § 6 corpus format) plus round-trip tests (`unicode → kruti → unicode` recovers the original for corpus entries where that's expected to hold).

## Phase 11 — Smart Detection

**Objective:** working classifier per brief § 1/§ 2.
**Dependencies:** Phase 9 (needs real Kruti Dev pattern knowledge to detect it).
**Expected output:** `lib/hindi/detect.ts` implementing Unicode-range detection (Devanagari codepoints) and known-legacy-pattern detection for Kruti Dev; returns `'unicode' | 'legacy_krutidev' | 'unknown'`, never guesses on unrecognized input (AI_RULES.md rule 10). `detectTextEncoding` Server Action (API.md § 4) and Hindi Converter UI wiring (paste → auto-suggest direction → user confirms).
**Tests required:** unit tests covering clearly-Unicode input, clearly-Kruti Dev input, and clearly-neither input (must return `'unknown'`, not a guess) — plus the same golden-corpus samples run through detection to confirm they're classified correctly before conversion.

## Phase 12 — Admin Panel

**Objective:** full admin panel per brief § 7.
**Dependencies:** Phase 3, Phase 4.
**Expected output:** `admin_users` provisioning process documented/scripted (DEPLOYMENT.md); `/admin/*` routes with server-side admin check (SECURITY.md § 2) on every page and action; user search/view, balance view, add/remove credits (`adminAdjustCredits`), transaction history view, pending payment queue (built fully once Phase 13 lands `payments`, or stubbed against an empty table until then), basic tool-usage counts (`adminGetToolUsageStats`).
**Tests required:** E2E — non-admin cannot reach `/admin/*` (redirected) and cannot call admin Server Actions (403, per TESTING.md § 4); admin can search a user and adjust their credits, balance updates and a `credit_transactions` row appears with `created_by` set.

## Phase 13 — UPI/UTR Payment Flow

**Objective:** working manual payment flow per brief § 6.
**Dependencies:** Phase 4, Phase 12 (admin approval queue), **M4 and M5 for launch** (mechanism can be built with placeholder pricing/payee info, but must be confirmed before real launch).
**Expected output:** `pricing_plans` seeded (placeholder or confirmed values); buy-credits UI showing packs (`getCreditPacks`) and UPI payment instructions; `submitUtrPayment` flow; admin pending-queue approve/reject wired to real data (`adminApprovePayment`/`adminRejectPayment`) with the idempotency guard from DATABASE.md/SECURITY.md § 7.
**Tests required:** E2E full flow (submit UTR → appears in admin queue → approve → balance updates); duplicate-UTR rejection test; double-approval idempotency test (per TESTING.md § 2/§ 4).

## Phase 14 — Security Hardening

**Objective:** close the loop on every item in [SECURITY.md](SECURITY.md) that isn't already covered by earlier phases' own tests.
**Dependencies:** Phases 1–13.
**Expected output:** rate limiting on `submitUtrPayment`, `detectTextEncoding`, `convertHindiText`, and auth endpoints; CSP header configured; explicit audit pass confirming no service-role key reachable from any client bundle; explicit audit pass confirming RLS is enabled (not just policy-defined but actually *enabled*) on every table.
**Tests required:** full SECURITY test suite per TESTING.md § 4 (admin bypass attempts, cross-user tampering attempts, implausible-result rejection, spoofed-file-type rejection, XSS injection attempts, rate-limit trigger tests).

## Phase 15 — Testing (consolidation pass)

**Objective:** confirm the full test suite from [TESTING.md](TESTING.md) is complete and green, not just per-phase spot checks.
**Dependencies:** Phases 1–14.
**Expected output:** CI pipeline running unit + integration + E2E + security test suites on every PR; Hindi golden corpus at full coverage across all required categories (TESTING.md § 6) including real deed samples (M2) reviewed for PII.
**Tests required:** this phase *is* the test consolidation — deliverable is a green CI run covering every category in TESTING.md.

## Phase 16 — Deployment

**Objective:** production environment live per [DEPLOYMENT.md](DEPLOYMENT.md).
**Dependencies:** Phase 15.
**Expected output:** production Supabase project provisioned, migrations applied, production env vars set in Vercel, custom domain (if applicable) with HTTPS confirmed, at least one real `admin_users` row provisioned, `pricing_plans`/`tool_pricing` set to client-confirmed values (M4), UPI payee details (M5) live in the buy-credits UI.
**Tests required:** production smoke test against every item in the Production Checklist (DEPLOYMENT.md § Production Checklist).

## Phase 17 — Final Acceptance Testing

**Objective:** verify every line of the brief's Acceptance Test / Handover section (§ 12) against production.
**Dependencies:** Phase 16.
**Expected output:** each of the following demonstrated on the live production site and signed off:
- [ ] Photo successfully compressed below 100 KB.
- [ ] Passport photo generated and downloaded.
- [ ] Kruti Dev ↔ Unicode conversion demonstrated on real deed text.
- [ ] Legacy/ASCII-style sample tested.
- [ ] Credit deduction/addition works correctly.
- [ ] Admin can manually adjust credits.
- [ ] Payment/UTR flow works.
- [ ] Source code, database/schema, admin access, and deployment access handed over.
**Tests required:** this phase's checklist *is* the test — a manual, recorded sign-off pass, not new automated tests.
