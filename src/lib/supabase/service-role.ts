import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Bypasses RLS. Never import this from a file reachable by client
 * components — `server-only` makes any such import a build-time error.
 * Used exclusively to call the SECURITY DEFINER credit functions
 * (settle_tool_usage, approve_payment, reject_payment, admin_adjust_credits)
 * from trusted Server Action code, per SECURITY.md § 3/§ 4.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
