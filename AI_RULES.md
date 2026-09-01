# Eduveera Tools — Rules for AI Coding Agents

Binding rules for any AI agent (or human) implementing this codebase. When a rule and a convenience conflict, the rule wins. If a request conflicts with these rules or with [PRD.md](PRD.md), stop and flag it rather than proceeding.

## Scope discipline

1. **Never invent requirements.** If it's not in `docs/Eduveera_Developer_Final_MVP_Brief_v2.pdf` or [PRD.md](PRD.md), it's not a requirement. Reasonable technical implementation choices are fine and expected — label them as such (see the `[Technical Recommendation]` convention used throughout these docs) — but don't add product behavior the brief never asked for.
2. **Follow the PRD.** [PRD.md](PRD.md) is the product source of truth derived from the brief. Implementation must match it. If the PRD is ambiguous or silent on something needed to proceed, ask rather than guess.
3. **Do not add out-of-scope features.** The brief explicitly excludes: native Android/iOS apps, an advanced PDF editor, AI face detection, AI background removal, large-scale analytics/reporting, a referral/affiliate system, complex subscription/billing management, and any tool/feature not listed in the brief without prior approval. Do not build these even if they seem like natural extensions.
4. **Do not rewrite working code unnecessarily.** Small, targeted changes over speculative refactors. If something works and isn't part of the current task, leave it.

## Credit system

5. **Never modify credit balance client-side.** `credits.balance` and `credit_transactions` are written only by server-side code (Server Actions using service-role/`SECURITY DEFINER` functions), never by a client-side Supabase call, never trusting a client-supplied amount. See [ARCHITECTURE.md](ARCHITECTURE.md) § 6 and [SECURITY.md](SECURITY.md) § 5.
6. **Every credit mutation must create an auditable transaction.** No code path may change `credits.balance` without, in the same DB transaction, inserting a corresponding `credit_transactions` row. No exceptions, including one-off scripts or admin tooling.
7. **Failed tool processing must not deduct credits.** If a tool action's `status` is `'failed'`, `tool_usage.credits_charged` must be `0` and no `credit_transactions` row is created.
8. **Successful paid tool processing must deduct credits.** Image Compressor, Passport Photo, and Hindi Converter conversions are credit-metered per [PRD.md](PRD.md) § 7 — a genuine success must always result in the configured debit, read from `tool_pricing` server-side (never hard-coded, never client-supplied). Smart Detection is free per PRD and is not billed.

## Hindi conversion (highest-risk component)

9. **Never invent Hindi mappings.** Do not fabricate, guess, or approximate Kruti Dev ↔ Unicode glyph mappings or reordering rules. If a verified mapping table isn't available, leave the corresponding module unimplemented and file/keep a TODO — do not ship a guessed table. See [TODO.md](TODO.md) for the current missing-input status.
10. **Never assume arbitrary ASCII is Kruti Dev.** Smart Detection (and the converter's own input validation) must only recognize text that matches a known, verified legacy pattern. Unrecognized input returns `'unknown'` — never a best-effort guess. This applies to `detect.ts` and to `convertHindiText`'s server-side re-validation (see [API.md](API.md)).
11. **Keep Hindi mappings modular.** Mapping tables and reordering rules live in dedicated data modules under `lib/hindi/mappings/` and `lib/hindi/reorder.ts`, separate from the conversion orchestrator (`lib/hindi/convert.ts`). Adding a new legacy font must be possible by adding a new data module, not by editing orchestration logic. See [ARCHITECTURE.md](ARCHITECTURE.md) § 8.
12. **Every Hindi conversion bug requires a regression test.** Any reported conversion error gets a corresponding entry added to the golden test corpus (matras, half letters, conjuncts, punctuation, numbers, mixed Hindi/English, or whatever category the bug falls into) before or alongside the fix — see [TESTING.md](TESTING.md).

## Admin & authorization

13. **Admin operations require server-side authorization.** Every admin action re-checks `admin_users` membership server-side (in the Server Action itself), in addition to RLS enforcing the same at the database layer. A route-level UI redirect is not sufficient authorization on its own. See [SECURITY.md](SECURITY.md) § 2.

## Privacy

14. **Do not retain user files unnecessarily.** Prefer client-side processing that never uploads originals (per [ARCHITECTURE.md](ARCHITECTURE.md) § 9). If server-side file handling is ever added, it must use short-lived signed URLs and scheduled deletion, never a public bucket, and never persist longer than needed to serve the request.

## General engineering discipline

15. Treat every client request as attacker-controlled (per [SECURITY.md](SECURITY.md)) — validate and re-derive authority server-side, always.
16. Prefer the stack already chosen (Next.js, TypeScript, Tailwind, shadcn/ui, Supabase, Vercel) over introducing new frameworks/services for a task this scoped and budgeted. No microservices, no new backend languages/runtimes, no new database.
17. When a brief requirement and an easy implementation shortcut conflict (e.g. "prefer client-side" vs. "credits only change server-side"), follow the resolution already documented in [ARCHITECTURE.md](ARCHITECTURE.md) rather than re-deciding it ad hoc — and if a new such conflict appears, document the resolution the same way instead of quietly picking one.
