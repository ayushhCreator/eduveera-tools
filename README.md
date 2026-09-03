# Eduveera Tools

Paperless-registry utility tools added to the existing Eduveera website: an image compressor, a passport photo generator, and a Kruti Dev ↔ Unicode Hindi converter with smart legacy-encoding detection — gated behind a server-side credit system with a manual UPI/UTR payment flow and a small admin panel.

Source requirements: `docs/Eduveera_Developer_Final_MVP_Brief_v2.pdf`. Full spec derived from it: [PRD.md](PRD.md).

## What the MVP contains

- **Image Compressor** — upload, pick a target (Under 100/50/30 KB or custom), compress, download.
- **Passport Photo** — upload, crop/zoom/reposition, download a fixed passport-style JPG.
- **Hindi Converter** — Kruti Dev → Unicode and Unicode → Kruti Dev, built around verified legacy mapping tables (never guessed).
- **Smart Detection** — classifies pasted text as Unicode, a known legacy pattern, or unknown (never guesses).
- **Credit system** — server-side-only balance, fully ledgered (`credit_transactions`), successful paid tool actions debit, failures don't.
- **Manual UPI/UTR payments** — user submits a UTR, admin approves/rejects, approval credits atomically.
- **Admin panel** — user search, balance view, manual credit adjustment, transaction history, pending payment queue, basic tool-usage counts.

Explicitly **not** in this MVP: native mobile apps, an advanced PDF editor, AI face detection/background removal, large-scale analytics, referrals/affiliates, complex subscription billing, or any other unlisted feature. See [PRD.md](PRD.md) § 3.

## Technology Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres + Auth) · Vercel · GitHub.

Monolithic Next.js app — Server Actions as the API layer, no microservices. Rationale: [ARCHITECTURE.md](ARCHITECTURE.md).

## Repository Structure

```
eduveera-tools/
├── app/
│   ├── (dashboard)/dashboard/       # user dashboard
│   ├── tools/
│   │   ├── image-compressor/
│   │   ├── passport-photo/
│   │   └── hindi-converter/
│   ├── admin/                       # admin panel, server-side gated
│   ├── login/ signup/
│   └── api/                         # route handlers (e.g. future payment webhook)
├── lib/
│   ├── hindi/
│   │   ├── mappings/                # verified legacy font ↔ Unicode tables (data modules)
│   │   ├── reorder.ts               # matra/conjunct reordering rules
│   │   ├── detect.ts                # Smart Detection
│   │   ├── convert.ts               # conversion orchestrator
│   │   └── __tests__/golden-corpus/ # Hindi regression test corpus
│   └── supabase/                    # client helpers (browser/server/service-role)
├── supabase/
│   └── migrations/                  # versioned schema
├── docs/
│   └── Eduveera_Developer_Final_MVP_Brief_v2.pdf
└── (this file, PRD.md, ARCHITECTURE.md, DATABASE.md, API.md, SECURITY.md,
     AI_RULES.md, TESTING.md, DEPLOYMENT.md, TODO.md)
```

## Development Setup

1. `npm install`
2. `npx supabase init` (first time only), then `npx supabase start` — spins up local Postgres/Auth/PostgREST/Studio via Docker and applies everything in `supabase/migrations/` automatically. Prints a local `API URL`, `anon key`, and `service_role key`.
3. Copy `.env.example` → `.env.local` and fill in the three values from step 2 (or your Supabase project's URL/keys if pointing at a shared/hosted project instead).
4. `npm run dev` — app at `http://localhost:3000`.

Verify the database layer independently of the app with `npm run db:test` (`scripts/test-db/run.sh`) — spins up a throwaway `postgres:16` container, applies the migrations, and asserts the schema, RLS policies, and credit-mutation functions (including a concurrent-debit race test) all behave correctly.

Full environment breakdown (dev/staging/production): [DEPLOYMENT.md](DEPLOYMENT.md).

## Environment Variables

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (RLS enforces actual access control). |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only, secret** | Used only inside server-side credit-mutation logic. Never exposed to the client. |

Never commit `.env.local` or any real secret. Details: [SECURITY.md](SECURITY.md) § 17, [DEPLOYMENT.md](DEPLOYMENT.md) § Secrets.

## Testing

`npm test` (unit + integration), `npm run test:e2e` (Playwright). Full strategy, including the Hindi golden-corpus approach: [TESTING.md](TESTING.md).

## Deployment

GitHub → Vercel (build/hosting, auto preview per PR) → Supabase (Postgres + Auth). Merge to `main` auto-deploys to production. Full steps, migrations, rollback strategy, and the pre-launch checklist: [DEPLOYMENT.md](DEPLOYMENT.md).

## Documentation Index

| Doc | Contents |
|---|---|
| [STATUS.md](STATUS.md) | **Start here if picking this project up cold.** What's done, what's left, known accepted risks. |
| [PRD.md](PRD.md) | Product requirements, user journeys, acceptance criteria — the product source of truth. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design: frontend, backend, DB, auth, credits, payments, Hindi conversion, file processing, deployment. |
| [DATABASE.md](DATABASE.md) | Full Postgres schema, constraints, indexes, transaction rules. |
| [API.md](API.md) | Every Server Action: purpose, auth/authz, request/response, validation, errors, credit behavior. |
| [SECURITY.md](SECURITY.md) | Threat-model-driven security requirements across auth, credits, payments, files, and more. |
| [AI_RULES.md](AI_RULES.md) | Binding rules for AI coding agents working on this repo. |
| [TESTING.md](TESTING.md) | Test strategy, including the Hindi conversion golden-corpus process. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Environments, env vars, migrations, secrets, rollback, launch checklist. |
| [TODO.md](TODO.md) | Phased build roadmap with per-task objectives, dependencies, outputs, and required tests. |

Before writing code, read [AI_RULES.md](AI_RULES.md) — it governs how requirements, credits, and Hindi conversion must be handled in this codebase, and supersedes convenience.
