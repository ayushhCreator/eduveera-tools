"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { settleToolUsage } from "@/lib/credits/actions";
import type { ActionResult } from "@/lib/credits/errors";
import { detectEncoding, type DetectionResult } from "@/lib/hindi/detect";
import { convertText, type ConvertDirection } from "@/lib/hindi/convert";
import { rateLimited } from "@/lib/security/rate-limit";

// API.md § 4: "text: string (max length enforced, e.g. 20,000 chars)".
const MAX_TEXT_LENGTH = 20_000;
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Smart Detection (PRD.md § 6.4) — free, never settles credits. Requires
 * auth only as a rate-limiting anchor (SECURITY.md § 14), not because the
 * action itself costs anything.
 */
export async function detectTextEncoding(text: string): Promise<ActionResult<{ result: DetectionResult }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, code: "UNAUTHENTICATED", message: "not signed in" };

  if (rateLimited(`detect:${user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return { success: false, code: "VALIDATION", message: "rate_limited" };
  }

  if (text.trim().length === 0) {
    return { success: false, code: "VALIDATION", message: "text must not be empty" };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { success: false, code: "VALIDATION", message: `text exceeds max length of ${MAX_TEXT_LENGTH}` };
  }

  return { success: true, result: detectEncoding(text) };
}

/**
 * Hindi Converter (PRD.md § 6.3). Runs server-side per ARCHITECTURE.md § 6:
 * the server computes the result and, in the same call, knows definitively
 * whether it succeeded — so credit settlement happens here directly, no
 * separate client-reported "it worked" step like the image tools use.
 *
 * Right now `convertText` always returns `ok: false` (no mapping module is
 * registered yet — see convert.ts) so this always takes the unsupported
 * path below and never calls settleToolUsage. That's correct: an
 * unsupported conversion is a failure, not a billable success
 * (AI_RULES.md rule 7). Once a real mapping module lands (Phase 9), the
 * `ok: true` branch already does the right thing — no rewiring needed.
 */
export async function convertHindiText(
  text: string,
  direction: ConvertDirection,
): Promise<ActionResult<{ convertedText: string; newBalance: number; creditsCharged: number }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, code: "UNAUTHENTICATED", message: "not signed in" };

  if (rateLimited(`convert:${user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return { success: false, code: "VALIDATION", message: "rate_limited" };
  }

  if (text.trim().length === 0) {
    return { success: false, code: "VALIDATION", message: "text must not be empty" };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { success: false, code: "VALIDATION", message: `text exceeds max length of ${MAX_TEXT_LENGTH}` };
  }
  if (direction !== "kruti_to_unicode" && direction !== "unicode_to_kruti") {
    return { success: false, code: "VALIDATION", message: "invalid direction" };
  }

  const result = convertText(text, direction);

  if (!result.ok) {
    return { success: false, code: "VALIDATION", message: "unsupported_no_mapping_available" };
  }

  const settled = await settleToolUsage("hindi_converter", "success", { direction });
  if (!settled.success) {
    return settled;
  }

  return {
    success: true,
    convertedText: result.text,
    newBalance: settled.newBalance,
    creditsCharged: settled.creditsCharged,
  };
}
