"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentUser, requireAdmin, requireUser } from "@/lib/auth/session";
import { mapPostgresError, type ActionResult } from "@/lib/credits/errors";
import type { ToolName, ToolUsageStatus } from "@/lib/supabase/types";

// ------------------------------------------------------------
// Reads — RLS-scoped to the caller, no service role needed.
// ------------------------------------------------------------

export async function getCreditBalance(): Promise<ActionResult<{ balance: number }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, code: "UNAUTHENTICATED", message: "not signed in" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("credits").select("balance").eq("user_id", user.id).single();

  if (error) return { success: false, code: "INTERNAL", message: error.message };
  return { success: true, balance: data.balance };
}

export async function getMyTransactions(page: number, pageSize: number) {
  const user = await requireUser();
  const clampedSize = Math.min(pageSize, 50);
  const from = page * clampedSize;
  const to = from + clampedSize - 1;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("credit_transactions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { items: data, total: count ?? 0 };
}

export async function getMyToolUsage(page: number, pageSize: number) {
  const user = await requireUser();
  const clampedSize = Math.min(pageSize, 50);
  const from = page * clampedSize;
  const to = from + clampedSize - 1;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("tool_usage")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { items: data, total: count ?? 0 };
}

export async function getToolPricing(): Promise<Record<ToolName, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tool_pricing").select("tool, cost_credits");
  if (error) throw error;

  return Object.fromEntries(data.map((row) => [row.tool, row.cost_credits])) as Record<ToolName, number>;
}

// ------------------------------------------------------------
// Mutations — always via the service-role client calling the
// SECURITY DEFINER functions in 0004_credit_functions.sql. The acting
// user id always comes from the session, never from a parameter the
// client could forge. See ARCHITECTURE.md § 6.
// ------------------------------------------------------------

export async function settleToolUsage(
  tool: ToolName,
  status: ToolUsageStatus,
  metadata: Record<string, unknown> | null = null,
): Promise<ActionResult<{ newBalance: number; creditsCharged: number; toolUsageId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, code: "UNAUTHENTICATED", message: "not signed in" };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("settle_tool_usage", { p_user_id: user.id, p_tool: tool, p_status: status, p_metadata: metadata })
    .single();

  if (error) {
    const mapped = mapPostgresError(error);
    return { success: false, ...mapped };
  }

  return {
    success: true,
    newBalance: data.new_balance,
    creditsCharged: data.credits_charged,
    toolUsageId: data.tool_usage_id,
  };
}

export async function adminAdjustCredits(
  userId: string,
  amount: number,
  reason: string,
): Promise<ActionResult<{ newBalance: number }>> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { success: false, code: "FORBIDDEN", message: "admin access required" };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("admin_adjust_credits", { p_user_id: userId, p_admin_id: admin.id, p_amount: amount, p_reason: reason })
    .single();

  if (error) {
    const mapped = mapPostgresError(error);
    return { success: false, ...mapped };
  }

  return { success: true, newBalance: data.new_balance };
}

export async function approvePayment(
  paymentId: string,
): Promise<ActionResult<{ newBalance: number; creditsGranted: number }>> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { success: false, code: "FORBIDDEN", message: "admin access required" };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("approve_payment", { p_payment_id: paymentId, p_admin_id: admin.id })
    .single();

  if (error) {
    const mapped = mapPostgresError(error);
    return { success: false, ...mapped };
  }

  return { success: true, newBalance: data.new_balance, creditsGranted: data.credits_granted };
}

export async function rejectPayment(paymentId: string): Promise<ActionResult<object>> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { success: false, code: "FORBIDDEN", message: "admin access required" };

  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("reject_payment", { p_payment_id: paymentId, p_admin_id: admin.id });

  if (error) {
    const mapped = mapPostgresError(error);
    return { success: false, ...mapped };
  }

  return { success: true };
}
