/**
 * Conversion orchestrator: given (text, direction), looks up a mapping
 * module for the relevant font and runs mapping + reordering. See
 * ARCHITECTURE.md § 8.
 *
 * Design rule (AI_RULES.md rule 11): this file contains *no* mapping data
 * and *no* reordering rules — only routing/orchestration. Adding a new
 * legacy font is "register a module in MAPPING_REGISTRY", never "edit the
 * logic in this file."
 *
 * No mapping module is registered yet (blocked on M1, see TODO.md and
 * mappings/README.md), so every call currently falls through to the
 * `ok: false` branch below. That is correct behavior, not a bug — never
 * fabricate output when no verified mapping exists (AI_RULES.md rule 9).
 */

import type { ReorderRules } from "./reorder";

export type ConvertDirection = "kruti_to_unicode" | "unicode_to_kruti";

export type ConvertResult =
  | { ok: true; text: string }
  | { ok: false; reason: "no_mapping_available"; fontId: string };

/** Character-mapping data + reordering rules for one legacy font. */
export interface MappingModule {
  fontId: string;
  /** glyph code (as typed in the legacy font) -> Unicode codepoint(s) */
  legacyToUnicode: Record<string, string>;
  /** Unicode codepoint(s) -> glyph code (as typed in the legacy font) */
  unicodeToLegacy: Record<string, string>;
  reorderRules: ReorderRules;
}

/**
 * Registry of verified mapping modules, keyed by font id. Empty until a
 * real module (e.g. "krutidev") is added under mappings/ and registered
 * here — see mappings/README.md for the checklist.
 */
const MAPPING_REGISTRY: Record<string, MappingModule> = {};

/**
 * The only font this MVP targets is Kruti Dev (PRD.md § 6.3), so both
 * conversion directions resolve to the same font id. If a future font is
 * added, this would become a parameter rather than a constant.
 */
const TARGET_FONT_ID = "krutidev";

export function convertText(text: string, direction: ConvertDirection): ConvertResult {
  const mapping = MAPPING_REGISTRY[TARGET_FONT_ID];

  if (!mapping) {
    return { ok: false, reason: "no_mapping_available", fontId: TARGET_FONT_ID };
  }

  // Unreachable until a mapping module is registered above — kept here so
  // wiring in a real font is additive (register module -> this branch
  // activates), not a rewrite of the orchestrator or its callers.
  const table = direction === "kruti_to_unicode" ? mapping.legacyToUnicode : mapping.unicodeToLegacy;
  const reorderDirection = direction === "kruti_to_unicode" ? "visual_to_logical" : "logical_to_unicode_logical";

  const mapped = Array.from(text)
    .map((ch) => table[ch] ?? ch)
    .join("");
  const result = mapping.reorderRules.reorder(mapped, reorderDirection);

  return { ok: true, text: result };
}
