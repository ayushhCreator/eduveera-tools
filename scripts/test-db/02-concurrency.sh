#!/usr/bin/env bash
# Fires two concurrent settle_tool_usage() calls against a balance that
# can only cover one debit. Exactly one must succeed; the row lock
# (SELECT ... FOR UPDATE inside the function) must serialize the second
# call so it sees the post-debit balance, not a stale pre-debit read.
set -euo pipefail
PORT="$1"
DB=postgres
USER=postgres

psql_c() {
  # -t suppresses headers/row-counts for the query result itself, but psql
  # still appends a separate "INSERT 0 1"-style command-status line after
  # RETURNING output — take only the first line to get just the value.
  # (avoid piping into `head` here: with `set -o pipefail` a SIGPIPE from
  # psql writing past head's early close would be reported as a failure.)
  local out
  out=$(PGPASSWORD=postgres psql -h localhost -p "$PORT" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -t -A -c "$1")
  echo "${out%%$'\n'*}"
}

USER_ID=$(psql_c "insert into auth.users (email) values ('concurrency-test@example.com') returning id;")
psql_c "select admin_adjust_credits('$USER_ID'::uuid, (select user_id from admin_users limit 1), 1, 'concurrency test seed');" >/dev/null

OUT_A=/tmp/eduveera-concurrency-a.out
OUT_B=/tmp/eduveera-concurrency-b.out

(PGPASSWORD=postgres psql -h localhost -p "$PORT" -U "$USER" -d "$DB" -t -A \
  -c "select settle_tool_usage('$USER_ID'::uuid, 'image_compressor', 'success', '{}'::jsonb);" \
  > "$OUT_A" 2>&1) &
PID_A=$!

(PGPASSWORD=postgres psql -h localhost -p "$PORT" -U "$USER" -d "$DB" -t -A \
  -c "select settle_tool_usage('$USER_ID'::uuid, 'image_compressor', 'success', '{}'::jsonb);" \
  > "$OUT_B" 2>&1) &
PID_B=$!

wait "$PID_A" || true
wait "$PID_B" || true

SUCCESS_COUNT=$(grep -L "insufficient_credits" "$OUT_A" "$OUT_B" | wc -l)
FAIL_COUNT=$(grep -l "insufficient_credits" "$OUT_A" "$OUT_B" | wc -l)

FINAL_BALANCE=$(psql_c "select balance from credits where user_id = '$USER_ID'::uuid;")
LEDGER_COUNT=$(psql_c "select count(*) from credit_transactions where user_id = '$USER_ID'::uuid and reason = 'tool_usage:image_compressor';")
SUCCESS_ROWS=$(psql_c "select count(*) from tool_usage where user_id = '$USER_ID'::uuid and status = 'success';")

echo "outcome A: $(cat "$OUT_A")"
echo "outcome B: $(cat "$OUT_B")"
echo "final balance: $FINAL_BALANCE (expect 0)"
echo "ledger rows: $LEDGER_COUNT (expect 1)"
echo "success tool_usage rows: $SUCCESS_ROWS (expect 1)"

if [ "$SUCCESS_COUNT" -ne 1 ]; then
  echo "ASSERTION FAILED: expected exactly 1 successful debit, got $SUCCESS_COUNT"
  exit 1
fi
if [ "$FAIL_COUNT" -ne 1 ]; then
  echo "ASSERTION FAILED: expected exactly 1 rejected debit, got $FAIL_COUNT"
  exit 1
fi
if [ "$FINAL_BALANCE" -ne 0 ]; then
  echo "ASSERTION FAILED: final balance $FINAL_BALANCE, expected 0 (double-spend occurred if negative)"
  exit 1
fi
if [ "$LEDGER_COUNT" -ne 1 ]; then
  echo "ASSERTION FAILED: expected exactly 1 ledger row, got $LEDGER_COUNT"
  exit 1
fi

echo "PASS: concurrent debits serialized correctly, no double-spend"
