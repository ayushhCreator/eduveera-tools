# Eduveera Tools — Status (handoff doc)

Read this first if you're picking up this project cold. It's a snapshot, not a spec — for binding requirements/rules read [PRD.md](PRD.md) and [AI_RULES.md](AI_RULES.md) before changing anything.

**Last updated:** 2026-09-03. Base commit `141385f`; a batch of work since then
is **in the working tree, uncommitted** — see "Session 2026-09-03" below.

## What this is

Paperless-registry utility tools bolted onto the existing Eduveera website: image compressor, passport photo generator, Kruti Dev ↔ Unicode Hindi converter — gated behind a server-side credit system with manual UPI/UTR payments and a small admin panel. Built from `Eduveera_Developer_Final_MVP_Brief_v2.pdf`. Full spec: [PRD.md](PRD.md). Doc index: [README.md](../README.md).

## Done

All 17 roadmap phases (see [TODO.md](TODO.md) for the phase-by-phase breakdown) are implemented and verified:

- **Auth, DB, credits.** Supabase Auth + Postgres, RLS default-deny, credit mutations only via `SECURITY DEFINER` functions callable from server-side service-role code. Concurrency-tested (no double-spend) against a real Postgres instance via `npm run db:test`.
- **Image Compressor, Passport Photo.** Both working, gate-then-run credit pattern (client pre-flight check for UX, server-side re-check-and-settle is the real boundary).
- **Hindi Converter (Kruti Dev ↔ Unicode).** Real, working conversion both directions — not a placeholder. No verified mapping existed anywhere at project start; researched and ported from two independent sources (SIL International's formal TECkit spec, MIT-licensed; TGNYC's community JS converter, **no license file — shipped as an accepted risk, see "Known risks" below**), cross-checked against each other, validated via round-trip testing on real Hindi text. Full sourcing: `src/lib/hindi/mappings/krutidev.ts` header comment and [src/lib/hindi/mappings/README.md](../src/lib/hindi/mappings/README.md).
- **Smart Detection.** Unicode-range detection **and** legacy Kruti Dev detection, both real, not guessed. The Kruti Dev signature is derived at module load from `KRUTI_TO_UNICODE_TABLE` — any CP1252 extended-range byte (≥0x80) in the verified table is an unambiguous Kruti Dev glyph code; a single one is sufficient evidence. Pure-ASCII Kruti Dev stays `unknown` (indistinguishable from English — AI_RULES rule 10). 9 tests in `detect.test.ts`. (Implemented in the working tree, uncommitted.)
- **Admin panel.** User search, balance view, manual credit adjustment, transaction history, pending-payment queue. Every mutating/reading function independently checks admin authorization server-side.
- **UPI/UTR payments.** User submits UTR, admin approves/rejects, approval credits atomically. Duplicate submission and duplicate approval both correctly blocked (tested against real DB).
- **Security hardening.** CSP + security headers, rate limiting on text/payment actions (in-memory, single-instance — see "Known risks").
- **Testing.** 42 unit/integration tests, 14 Playwright E2E tests (desktop + mobile), all green. Hindi golden corpus: 9 pairs covering 7 of 8 required categories (matras, half letters, conjuncts, punctuation, numbers, mixed Hindi/English, real downloaded text + a full real fable, entry 09). Missing: real deed sample (see below).

**Verify it's still green before building on it:**
```
npm run typecheck && npm run lint && npm test && npm run build
npx playwright test
```

## What's left

**Deployment posture (user decision 2026-09-03): this is a DUMMY / demo deployment,
not a real-money launch.** For this posture, M4 (pricing) and M5 (UPI payee) placeholders
are **accepted as-is** — no real money changes hands, so fake prices and a placeholder
VPA are fine. Email confirmation is turned **off** (not needed for a demo). Items 1–2
below still apply verbatim before any real launch; they are just not blockers for the
demo.

Ranked by what actually blocks something vs. what's just not done yet:

1. **M4 — credit pricing values.** Mechanism is fully built and reads from config; the numbers themselves (per-tool cost, ₹-to-credit pack amounts) are placeholders. Needs the client. Blocks real launch, not the demo.
2. **M5 — UPI payee details** (VPA / QR / display name) shown in the buy-credits UI. Same story — placeholder, needs the client. Blocks real launch, not the demo.
3. **M2, remainder — a real deed sample.** A genuine property/registry deed is a private legal document with PII; not obtainable by web search, and no client-provided sample exists yet. Golden corpus has real Hindi text (not a deed) covering the other 7 categories. If a client-provided deed excerpt shows up, review for PII before adding as corpus entry 09 — see [src/lib/hindi/__tests__/golden-corpus/krutidev/README.md](../src/lib/hindi/__tests__/golden-corpus/krutidev/README.md).
4. **Playwright E2E job not wired into CI.** The job is written and commented out in `.github/workflows/ci.yml`. A hosted Supabase project now exists (see below) — remaining work is putting its URL / anon / service-role keys into GitHub Actions repo secrets and uncommenting the job.
5. **Passport Photo crop/zoom/reposition — no full interactive E2E.** `react-easy-crop` pointer-drag doesn't simulate well headlessly. Covered by unit tests on the pure crop math + a manual page-load/gate smoke check, not a full drag-crop-download cycle.
6. **Rate limiter is in-memory, single-instance.** Documented limitation (`src/lib/security/rate-limit.ts`), fine for one Vercel instance / low traffic, would need a shared store (Redis etc.) before scaling to multiple instances.
7. **Email confirmation — turned OFF for the demo** (user decision). Signup returns a
   live session immediately, straight to `/dashboard`, no email round-trip. Before a
   real launch: turn "Confirm email" back on **and** configure custom SMTP
   (Resend/SendGrid) + set the Site URL — the built-in mailer is ~2–3 emails/hour.

## Known risks (accepted, not oversights)

- **TGNYC license.** The Hindi converter ports code from a GitHub repo with no LICENSE file (all-rights-reserved by default under copyright). Flagged to the user 2026-09-02; user chose to ship as-is rather than contact the author or rebuild from the MIT-licensed source alone. Don't re-litigate this without new information — see `src/lib/hindi/mappings/krutidev.ts`'s "LICENSE NOTE" and [TODO.md](TODO.md) M1.
- **One documented mapping disagreement.** Byte 211 (a rare "half-ya" glyph) — SIL's spec and the TGNYC port disagree on character order; left as TGNYC's value rather than guessed, documented in `krutidev.ts`. A 2026-09-03 re-research pass against other public converters (rajbhasha.net, krutidevunicodeconverter.com, `ltrc/kru2uni`) found no better-licensed authoritative source and no new evidence on byte 211 — see [src/lib/hindi/mappings/README.md](../src/lib/hindi/mappings/README.md) "Re-research pass".
- **Mixed Hindi/English is inherently one-directional.** `unicode_to_kruti` on mixed text works; the reverse can't distinguish literal English from Kruti Dev codes that look like English (no font-run metadata in plain text). Not a bug — see the golden-corpus README "Known limitations."

## Session 2026-09-03 (in the working tree, not yet committed)

- **Hosted Supabase project live.** `.env.local` points at project `gkwzckpajngcdhoivouy`
  (new-format publishable + secret keys). All 5 migrations pushed (`supabase db push`,
  `migration list` shows local==remote). Auth trigger, RLS, credit functions, pricing
  seed all confirmed present on the remote.
- **Seed users:** `admin@eduveera.test` (in `admin_users`) and `demo@eduveera.test`,
  created via the admin API with `email_confirm: true`. Both started at 0 credits; the
  admin was funded via the real buy-credits → approve flow (works end to end on hosted).
- **Global nav + footer.** `src/components/site-nav.tsx` (server, desktop inline nav),
  `src/components/mobile-nav.tsx` (client, phone disclosure that closes on route change),
  `src/components/site-footer.tsx` — all gated on an authenticated user, wired into the
  root layout (`flex min-h-screen flex-col`, `<main flex-1>`). `isCurrentUserAdmin()`
  added to `src/lib/auth/session.ts`.
- **Responsive pass.** Normalised page padding to `p-4 sm:p-6` (dashboard, buy-credits,
  passport-photo, admin layout); dashboard + buy-credits headers stack on phone;
  dropped the dashboard's own logout/"signed in as" (the nav carries both).
- **Smart Detection — legacy Kruti Dev branch** implemented in `detect.ts` /
  `detect.test.ts` (also uncommitted, predates this session).
- **Golden-corpus entry 09** added — a full real Hindi fable, exact bidirectional match.
- **Converter re-research** — no better-licensed source; see the Known-risks note above.
- `CLAUDE.md` added at the repo parent (`/home/ayush-raj/The_Base/Eduveera/`).

`npm run typecheck && npm run lint && npm test && npm run build` all green (42 tests).
Nothing is committed or pushed — branch `master`, even with `origin/master`.

## Where to look

| Question | File |
|---|---|
| What are the product requirements? | [PRD.md](PRD.md) |
| What's the system architecture? | [ARCHITECTURE.md](ARCHITECTURE.md) |
| What rules must AI agents follow here? | [AI_RULES.md](AI_RULES.md) — read before touching credits or Hindi conversion |
| What's the phase-by-phase build plan / detailed blocker status? | [TODO.md](TODO.md) |
| How do I run this locally? | [README.md](../README.md) § Development Setup |
| How do I deploy it? | [DEPLOYMENT.md](DEPLOYMENT.md) |
