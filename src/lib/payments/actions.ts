"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/credits/errors";

// UPI payee details are not in the brief (blocker M5 — see TODO.md).
// Placeholder, clearly marked, not to be treated as real production
// payment information until confirmed.
export const UPI_PAYEE = {
  vpa: "PLACEHOLDER-CONFIRM-WITH-CLIENT@upi",
  name: "Eduveera (placeholder — confirm before launch)",
};

const UTR_PATTERN = /^[A-Za-z0-9]{6,32}$/;

export async function getCreditPacks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_plans")
    .select("*")
    .eq("active", true)
    .order("price_inr", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getMyPayments(page = 0, pageSize = 20) {
  const user = await requireUser();
  const clampedSize = Math.min(pageSize, 50);
  const from = page * clampedSize;
  const to = from + clampedSize - 1;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("payments")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { items: data, total: count ?? 0 };
}

export async function submitUtrPayment(
  pricingPlanId: string,
  utr: string,
): Promise<ActionResult<{ paymentId: string }>> {
  const user = await requireUser();
  const trimmedUtr = utr.trim();

  if (!UTR_PATTERN.test(trimmedUtr)) {
    return { success: false, code: "VALIDATION", message: "invalid_utr_format" };
  }

  const supabase = await createClient();

  // Amount/credits are looked up server-side from the pack — never
  // accepted as client input (SECURITY.md: assume the client can forge
  // any request).
  const { data: plan, error: planError } = await supabase
    .from("pricing_plans")
    .select("id, price_inr, credits")
    .eq("id", pricingPlanId)
    .eq("active", true)
    .maybeSingle();

  if (planError) return { success: false, code: "INTERNAL", message: planError.message };
  if (!plan) return { success: false, code: "NOT_FOUND", message: "invalid_or_inactive_pack" };

  const { data, error } = await supabase
    .from("payments")
    .insert({
      user_id: user.id,
      pricing_plan_id: plan.id,
      amount_inr: Number(plan.price_inr),
      credits_requested: plan.credits,
      utr: trimmedUtr,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    // Unique constraint on utr — same UTR submitted twice.
    if (error.code === "23505") {
      return { success: false, code: "CONFLICT", message: "utr_already_submitted" };
    }
    return { success: false, code: "INTERNAL", message: error.message };
  }

  return { success: true, paymentId: data.id };
}
