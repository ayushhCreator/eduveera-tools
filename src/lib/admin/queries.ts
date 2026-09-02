"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type { ToolName, ToolUsageStatus } from "@/lib/supabase/types";

/**
 * Read queries for the admin panel. Every export starts with
 * requireAdmin() — the page-level layout check is defense-in-depth, not
 * the security boundary; each function must independently refuse a
 * non-admin caller (SECURITY.md § 2, AI_RULES.md rule 13).
 *
 * These are plain reads via the RLS-scoped server client, not the
 * service-role client: admins have explicit SELECT policies on these
 * tables (supabase/migrations/0003_rls_policies.sql), so no FK/join
 * embedding is relied upon — `Relationships: []` in types.ts means
 * PostgREST embedded selects don't type-check, so user info is fetched
 * separately and merged in JS where needed.
 */

export type ProfileWithBalance = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  balance: number;
};

export async function adminListUsers(search?: string, page = 0, pageSize = 20) {
  await requireAdmin();
  const supabase = await createClient();

  const clampedSize = Math.min(pageSize, 100);
  const from = page * clampedSize;
  const to = from + clampedSize - 1;

  let query = supabase.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false });

  if (search) {
    const like = `%${search}%`;
    query = query.or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  }

  const { data: profiles, error, count } = await query.range(from, to);
  if (error) throw error;

  const ids = profiles.map((p) => p.id);
  const { data: balances, error: balError } = await supabase.from("credits").select("user_id, balance").in(
    "user_id",
    ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"],
  );
  if (balError) throw balError;

  const balanceByUser = new Map(balances.map((b) => [b.user_id, b.balance]));
  const items: ProfileWithBalance[] = profiles.map((p) => ({
    ...p,
    balance: balanceByUser.get(p.id) ?? 0,
  }));

  return { items, total: count ?? 0 };
}

export async function adminGetUser(userId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  const [{ data: credits, error: creditsError }, { data: transactions, error: txError }, { data: toolUsage, error: usageError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      supabase.from("credits").select("balance").eq("user_id", userId).maybeSingle(),
      supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("tool_usage").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);

  if (creditsError) throw creditsError;
  if (txError) throw txError;
  if (usageError) throw usageError;
  if (paymentsError) throw paymentsError;

  return {
    profile,
    balance: credits?.balance ?? 0,
    transactions: transactions ?? [],
    toolUsage: toolUsage ?? [],
    payments: payments ?? [],
  };
}

export type PendingPayment = {
  id: string;
  user_id: string;
  amount_inr: string;
  credits_requested: number;
  utr: string | null;
  created_at: string;
  user: { name: string | null; email: string } | null;
};

export async function adminListPendingPayments(page = 0, pageSize = 20) {
  await requireAdmin();
  const supabase = await createClient();

  const clampedSize = Math.min(pageSize, 100);
  const from = page * clampedSize;
  const to = from + clampedSize - 1;

  const {
    data: payments,
    error,
    count,
  } = await supabase
    .from("payments")
    .select("*", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .range(from, to);
  if (error) throw error;

  const ids = [...new Set(payments.map((p) => p.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (profileError) throw profileError;

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const items: PendingPayment[] = payments.map((p) => ({
    ...p,
    user: profileById.get(p.user_id) ?? null,
  }));

  return { items, total: count ?? 0 };
}

export async function adminGetToolUsageStats() {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.from("tool_usage").select("tool, status");
  if (error) throw error;

  const counts = new Map<string, { tool: ToolName; successCount: number; failedCount: number }>();
  for (const row of data as { tool: ToolName; status: ToolUsageStatus }[]) {
    const entry = counts.get(row.tool) ?? { tool: row.tool, successCount: 0, failedCount: 0 };
    if (row.status === "success") entry.successCount++;
    else entry.failedCount++;
    counts.set(row.tool, entry);
  }

  return [...counts.values()];
}

export async function adminCountPendingPayments() {
  await requireAdmin();
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;

  return count ?? 0;
}
