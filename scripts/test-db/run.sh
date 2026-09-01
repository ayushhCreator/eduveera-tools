#!/usr/bin/env bash
# Local DB verification harness: bare postgres:16 container + our real
# migrations + a stub of the Supabase-provided auth schema/roles. Verifies
# schema, constraints, trigger, RLS, and the credit-mutation functions
# (including concurrency) without needing a live Supabase project.
#
# Usage: ./scripts/test-db/run.sh
set -euo pipefail

CONTAINER=eduveera-test-db
PORT=55432
DB=postgres
USER=postgres
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" postgres:16 >/dev/null

echo "waiting for postgres..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U "$USER" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

psql_run() {
  PGPASSWORD=postgres psql -h localhost -p "$PORT" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -f "$1"
}

echo "== bootstrap (stub Supabase auth schema/roles) =="
psql_run "$ROOT/scripts/test-db/00-bootstrap-local.sql"

echo "== applying migrations =="
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "-- $f"
  psql_run "$f"
done

echo "== assertions =="
psql_run "$ROOT/scripts/test-db/01-assertions.sql"

echo "== concurrency test =="
bash "$ROOT/scripts/test-db/02-concurrency.sh" "$PORT"

echo "ALL DB CHECKS PASSED"
