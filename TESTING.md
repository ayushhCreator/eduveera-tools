# Eduveera Tools — Testing Strategy

## 1. Unit Tests

- **Hindi conversion:** `lib/hindi/mappings/*`, `lib/hindi/reorder.ts`, `lib/hindi/detect.ts`, `lib/hindi/convert.ts` — each mapping table and reordering rule tested in isolation before being exercised through the orchestrator. See § 6 for the dedicated Hindi test strategy.
- **Credit math:** debit/credit sign handling, insufficient-balance rejection, `balance_after` snapshot correctness — pure-function-level tests around the transactional logic (mocked DB layer or a test Postgres instance, see § 2).
- **Validation logic:** request-shape validation for every Server Action in [API.md](API.md) (e.g. UTR format check, tool enum checks, max-length text checks).
- Framework: **[Technical Recommendation]** Vitest (fast, works well with TypeScript + Next.js, no strong reason to pick Jest instead here).

## 2. Integration Tests

Against a real (local/test-project) Supabase Postgres instance — not mocked — so RLS policies and DB constraints are actually exercised, not assumed.

- **Credit transaction atomicity:** tool debit, payment approval, admin adjustment each tested end-to-end against the DB — assert `credits.balance` and `SUM(credit_transactions.amount)` stay equal after every operation (the core invariant from [DATABASE.md](DATABASE.md)).
- **RLS enforcement:** authenticated as a normal user, assert direct `INSERT`/`UPDATE` attempts against `credits`/`credit_transactions` are rejected by Postgres; authenticated as non-admin, assert admin-only reads/writes are rejected.
- **Idempotency:** submit the same UTR twice → second rejected; approve the same payment twice (including a simulated race, e.g. two concurrent calls) → only one credit grant, second gets `409`.
- **Trigger correctness:** new `auth.users` row → matching `profiles` + `credits` (balance 0) rows created automatically.

## 3. End-to-End Tests

Framework: **[Technical Recommendation]** Playwright (good mobile-viewport emulation support, matches the mobile-first requirement).

Golden-path flows, each run at both desktop and mobile viewport:
- Sign up → land on dashboard with 0 balance.
- Admin manually grants credits to a test user → user sees updated balance.
- Image Compressor: upload → pick "Under 100 KB" → download → resulting file verified ≤100 KB → balance decremented by the configured cost → a `credit_transactions` row exists.
- Passport Photo: upload → crop/reposition → download JPG → balance decremented accordingly.
- Hindi Converter: paste a known Kruti Dev sample → Smart Detection identifies it → convert → correct Unicode output → balance decremented.
- Hindi Converter: paste Unicode text → convert to Kruti Dev → correct output.
- Insufficient balance: user with 0 credits attempts a paid tool → blocked with a clear message, no `tool_usage` success row created.
- UTR flow: submit UTR → appears in admin pending queue → admin approves → user balance updates → submit the *same* UTR again → rejected.

## 4. Security Tests

- Attempt to call `adminAdjustCredits`/`adminApprovePayment`/etc. as a non-admin authenticated user → expect `403`, no state change.
- Attempt to call any tool-result or payment action for another user's id (by tampering with a request body field, if one exists) → confirm the server ignores it and uses the session-derived id instead.
- Attempt to submit an implausible `recordToolResult` (e.g. claim `finalKB` far outside what the preset allows) → expect rejection, no credit deduction.
- Upload a file with a spoofed extension/MIME type (e.g. a script renamed `.jpg`) to any path that does touch the server → expect rejection on content-based validation, not just filename/type.
- Attempt XSS via pasted Hindi/English text, admin `reason` field, and profile `name` → confirm rendered as escaped text, not executed.
- Confirm rate limiting triggers on repeated rapid calls to `detectTextEncoding`/`convertHindiText`/`submitUtrPayment`.
- Full checklist cross-reference: [SECURITY.md](SECURITY.md).

## 5. Mobile Tests

- Every tool page and the dashboard tested at common mobile viewports (e.g. 375×667, 390×844) via Playwright device emulation, plus a manual pass on at least one real Android and one real iOS device before release (brief explicitly requires Image Compressor to "work smoothly on mobile," and the general UI/UX requirement is mobile-first).
- Specifically verify: file upload from mobile camera/gallery works, crop/zoom/reposition on Passport Photo is usable via touch, and paste-from-clipboard works for the Hindi Converter on mobile browsers.

## 6. Hindi Conversion Test Strategy

This is the highest-risk area of the product (brief § 2) and gets the most rigorous testing of anything in the MVP.

### Required coverage categories (from the brief)
Every supported legacy font mapping must have golden-corpus coverage across all of:
1. **Matras** (vowel signs) — including matras that reorder visually vs. logically.
2. **Half letters** (conjunct-forming halant combinations).
3. **Conjuncts** (multi-consonant clusters).
4. **Punctuation** (Devanagari-specific and shared with English, e.g. । and ॥).
5. **Numbers** (both Devanagari numerals and Latin digits appearing inside Hindi text).
6. **Mixed Hindi/English text** (code-switched sentences, common in real deeds — names, addresses, English abbreviations embedded in Hindi text).
7. **Real deed samples** — actual registry/deed document text, not synthetic sentences (brief § 2, § 12 acceptance test explicitly requires this).
8. **Supported legacy/ASCII-style samples** — text in the specific legacy font(s) actually being supported, as opposed to generic/arbitrary ASCII.

**Current status:** categories 7 and 8 have **no source data yet** — the brief contains no actual deed samples or mapping tables. This is a blocking dependency, tracked in [TODO.md](TODO.md), not something to synthesize or approximate.

### Golden test corpus — maintenance strategy

- Location: `lib/hindi/__tests__/golden-corpus/<font-id>/` — one subdirectory per supported legacy font (starting with `krutidev/`).
- Format: paired files — `NN-description.legacy.txt` (source) and `NN-description.unicode.txt` (expected Unicode output), one pair per test case, so both directions (Kruti Dev→Unicode and Unicode→Kruti Dev round-trip) can be tested from the same pair.
- Each pair is tagged (via filename prefix or a manifest JSON) with which coverage category it exercises (matra/half-letter/conjunct/punctuation/number/mixed/real-deed/legacy-sample) so coverage gaps are visible at a glance.
- **Every real deed sample added to the corpus must have its source noted** (e.g. "provided by client, deed dated X" or "sanitized excerpt from Y") and must be reviewed for any PII before being committed — deed text can contain names, addresses, property details. Redact/replace PII with realistic placeholder text that preserves the same linguistic patterns (matras, conjuncts, etc.) rather than committing raw personal data to the repo.
- **Growth process:** every Hindi conversion bug fix adds a new corpus entry reproducing the bug before the fix is considered complete (AI_RULES.md rule 12). Corpus only grows; entries are never deleted, only superseded if a mapping table is deliberately revised (with a note explaining why).
- Corpus tests run in CI on every PR touching `lib/hindi/**` — a single failing corpus entry blocks merge.

## 7. What's explicitly not tested (out of scope, matches PRD non-goals)

- Load/performance testing at scale (no large-scale analytics/traffic requirement in the brief).
- Native mobile app testing (no native app in scope).
- Payment gateway (Razorpay) test suite — not built in MVP; add when that integration is built.
