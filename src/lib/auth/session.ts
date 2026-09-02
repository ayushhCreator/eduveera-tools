import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * The only sanctioned way to learn "who is calling" in a Server Action or
 * Server Component: derived from the request's session cookie, never from
 * a client-supplied id. See AI_RULES.md rule 15 / SECURITY.md § 1.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("unauthenticated");
  }
  return user;
}

/**
 * Throws unless the caller is both authenticated and present in
 * admin_users. This is the application-layer half of the two-layer
 * defense described in SECURITY.md § 2 — RLS is the other half.
 */
export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();

  if (!data) {
    throw new Error("forbidden");
  }
  return user;
}
