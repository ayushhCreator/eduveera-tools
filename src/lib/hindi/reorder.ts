/**
 * Matra/conjunct reordering rules.
 *
 * Legacy fonts like Kruti Dev store characters in *visual* order (e.g. a
 * pre-base matra glyph typed before the consonant it visually precedes).
 * Unicode Devanagari requires *logical* order (consonant, then matra,
 * reordered by the rendering engine). Converting between the two isn't a
 * character-for-character glyph swap — it also requires reordering rules
 * specific to each font's visual-order conventions.
 *
 * This is deliberately a separate module from `mappings/` (character data)
 * and `convert.ts` (orchestration) per ARCHITECTURE.md § 8 and AI_RULES.md
 * rule 11 — adding a new legacy font's reordering behavior must not require
 * editing the orchestrator.
 *
 * No verified reordering rules exist yet for any font (blocked on M1, see
 * TODO.md and mappings/README.md). This module currently only exports the
 * shape; every font-specific rule set is added alongside its mapping module
 * in a future phase.
 */

export type ReorderDirection = "visual_to_logical" | "logical_to_unicode_logical";

/**
 * Per-font reordering rule set. A real implementation (once verified data
 * exists) would describe, e.g., which matra codepoints move relative to
 * which consonant when converting in a given direction.
 */
export interface ReorderRules {
  fontId: string;
  reorder(text: string, direction: ReorderDirection): string;
}

/**
 * No reordering rules are registered for any font yet. Calling this is
 * always a bug right now — there is nothing to look up — so it throws
 * rather than silently returning the input unchanged (which would look
 * like a no-op success instead of the "not implemented" state it is).
 */
export function getReorderRules(fontId: string): ReorderRules {
  throw new Error(`no reorder rules registered for font "${fontId}" (blocked on M1, see TODO.md)`);
}
