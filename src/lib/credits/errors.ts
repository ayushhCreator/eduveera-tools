/**
 * Result shape used by every credit-related Server Action, matching the
 * "Error shape convention" in API.md. Callers branch on `success` instead
 * of try/catch, so the UI never has to guess what a thrown Error means.
 */
export type ActionResult<T> = ({ success: true } & T) | { success: false; code: ErrorCode; message: string };

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INSUFFICIENT_CREDITS"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "INTERNAL";

/**
 * Maps the plain-text messages raised by our Postgres functions
 * (supabase/migrations/0004_credit_functions.sql) to a typed error code.
 * Keep this in sync with that file — every `raise exception '...'` there
 * needs an entry here or it falls through to INTERNAL.
 */
const PG_ERROR_CODES: Record<string, ErrorCode> = {
  insufficient_credits: "INSUFFICIENT_CREDITS",
  insufficient_balance: "INSUFFICIENT_CREDITS",
  payment_not_pending: "CONFLICT",
  zero_amount: "VALIDATION",
  reason_required: "VALIDATION",
  invalid_status: "VALIDATION",
  unknown_tool: "VALIDATION",
  user_not_found: "NOT_FOUND",
};

export function mapPostgresError(error: { message: string }): { code: ErrorCode; message: string } {
  const code = PG_ERROR_CODES[error.message];
  if (code) {
    return { code, message: error.message };
  }
  return { code: "INTERNAL", message: error.message };
}
