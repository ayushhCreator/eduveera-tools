# Eduveera Tools — Deployment

Low-cost stack per the brief's budget: GitHub → Vercel → Supabase. No additional infrastructure.

## Environments

| Environment | Purpose | Vercel | Supabase |
|---|---|---|---|
| **Development** | Local machine | `next dev`, local `.env.local` | Either a local Supabase (`supabase start`, Docker) or a shared dev Supabase project — recommend local for schema iteration, shared dev project once schema stabilizes. |
| **Staging/Preview** | Per-PR review | Vercel Preview Deployments (automatic per PR/branch) | A dedicated Supabase **staging** project (not prod, not local) — Preview deployments point at it via Vercel Preview env vars. |
| **Production** | Live site | Vercel Production (deploys from `main`) | Supabase **production** project. |

Using one shared Supabase *staging* project (not one-per-PR) is the pragmatic choice for this budget — spinning up a fresh Supabase project per PR is unnecessary overhead for a small team/single developer. **[Technical Recommendation]**

## Environment Variables

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server, all envs | Safe to expose — it's the project URL, not a secret. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server, all envs | Safe to expose — RLS is what actually protects data, not secrecy of this key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only**, all envs | Never `NEXT_PUBLIC_*`. Bypasses RLS — used only inside Server Action code that implements the credit-mutation functions. Set in Vercel project settings per environment, never committed. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Server only | Not needed for MVP manual-UTR path; reserved for the future gateway integration. |
| `ADMIN_NOTIFICATION_EMAIL` (optional) | Server only | If a "new pending payment" notification is added — not a Day-1 requirement, don't build until asked. |

`.env.example` in the repo lists variable names with placeholder values (never real secrets) so a new developer knows what to set locally.

## Development Environment Setup

1. Clone repo.
2. `npm install`.
3. Copy `.env.example` → `.env.local`, fill in a dev/local Supabase project's URL + anon key (+ service role key for local-only testing of admin/credit flows).
4. `supabase start` (if using local Supabase) or point at the shared dev project.
5. Run migrations: `supabase db push` (or `supabase migration up` against local).
6. `npm run dev`.

## Staging/Preview Environment

- Every PR automatically gets a Vercel Preview deployment.
- Preview deployments use Vercel's **Preview** environment variable scope, pointed at the Supabase **staging** project — so preview traffic never touches production data.
- Database migrations for staging are applied manually (or via a CI step, see below) before merging a PR that depends on a schema change — a preview deployment does not auto-run migrations against a shared staging DB (that would risk one PR's migration affecting another PR's preview).

## Production Environment

- Deploys from `main` via Vercel's GitHub integration — merge to `main` → automatic production deploy.
- Production environment variables set in Vercel project settings, **Production** scope only.
- Supabase production project is separate from staging/dev — no shared credentials, no shared data.

## Deployment Steps (standard flow)

1. Branch off `main`, implement + test locally.
2. Open PR → Vercel Preview deployment auto-builds → manual QA against the preview URL.
3. If the PR includes a schema change, apply the migration to the **staging** Supabase project and re-test against preview before merge.
4. Merge PR → `main` updated.
5. Vercel auto-deploys `main` to production.
6. Apply the same migration to the **production** Supabase project (see § Database Migrations — do this deliberately, not automatically, until the process is trusted).
7. Smoke-test production against the [PRD.md](PRD.md) § 12 acceptance criteria for anything the release touched.

## Database Migrations

- Managed via Supabase CLI migration files in `supabase/migrations/`, committed to the repo — schema is version-controlled, not edited ad hoc via the Supabase dashboard.
- Local dev: `supabase migration new <name>` → edit SQL → `supabase db reset` (local) to verify it applies cleanly from scratch.
- Staging: `supabase db push --project-ref <staging-ref>` (or the CLI's linked-project equivalent) after PR review, before merge, when the PR changes schema.
- Production: same command against the production project ref, run deliberately as its own step (§ above) — **not** wired into automatic CI/CD until the team has enough migration history to trust it unattended. **[Technical Recommendation]** For a project this size, a human running one CLI command for prod migrations is safer than premature automation.
- Every migration must be additive/backward-compatible where possible (add columns nullable or with defaults, don't drop columns in the same release that stops using them) so a rollback of the app code doesn't require a matching down-migration under time pressure.

## Secrets

- Managed exclusively via Vercel's per-environment encrypted environment variables and, for local dev, a git-ignored `.env.local`.
- No secrets in the repo, ever — not in code, not in `supabase/migrations/*.sql` (migrations reference roles/policies, never embed keys), not in committed `.env` files.
- Rotation: if `SUPABASE_SERVICE_ROLE_KEY` is ever suspected leaked, rotate it in the Supabase dashboard immediately and update the Vercel env var for every affected environment — this invalidates the old key instantly.

## Rollback Strategy

- **App code:** Vercel keeps every deployment; rolling back is promoting a previous deployment via the Vercel dashboard/CLI (`vercel rollback`) — near-instant, no rebuild needed.
- **Database:** because migrations are additive-first (§ above), most app-code rollbacks don't need a matching schema rollback. If a migration itself must be reverted, write and apply an explicit down-migration — never manually hand-edit the production schema outside a migration file.
- **Credit-system safety net:** because every credit mutation is transactional and ledgered (`credit_transactions`), a bad deploy that affected credits can be audited and, if needed, corrected via a documented admin adjustment (with `reason` explaining the correction) rather than requiring a data rollback.

## Production Checklist (before first real launch)

- [ ] All [PRD.md](PRD.md) § 12 acceptance criteria pass against production (not just staging).
- [ ] RLS enabled and verified on every table (§ SECURITY.md § 3) — spot-check with the anon/authenticated roles directly, not just through the app.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and any gateway secrets present in Vercel **Production** env only, absent from client bundle (verify via built output / browser devtools network+source inspection).
- [ ] HTTPS enforced (Vercel default — confirm custom domain, if any, has a valid cert and HTTP→HTTPS redirect).
- [ ] `tool_pricing` and `pricing_plans` seeded with real (client-confirmed) values, not placeholders — see [TODO.md](TODO.md).
- [ ] At least one `admin_users` row provisioned for the real admin(s) before handover.
- [ ] Hindi conversion golden corpus passes in CI, including any real-deed samples obtained by then.
- [ ] Backup/point-in-time-recovery enabled on the Supabase production project (Supabase project settings — confirm plan tier supports it).
- [ ] Source code, schema (migrations), admin access, and deployment access (GitHub + Vercel + Supabase project access) handed over per brief § 12.
