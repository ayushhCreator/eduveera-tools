/**
 * Conversion orchestrator: given (text, direction), looks up a mapping
 * module for the relevant font and delegates the actual transformation to
 * it. See ARCHITECTURE.md § 8.
 *
 * Design rule (AI_RULES.md rule 11): this file contains *no* mapping data
 * and *no* reordering rules — only routing/orchestration. Adding a new
 * legacy font is "register a module in MAPPING_REGISTRY", never "edit the
 * logic in this file." A `MappingModule` owns its full text transform
 * (rather than exposing separate char-table + generic-reorder pieces for
 * this file to combine) because Kruti Dev's real algorithm interleaves
 * substitution and position-fixing in a direction-dependent order — a
 * generic "map then reorder" pipeline can't express that without silently
 * corrupting multi-character glyph sequences. See mappings/krutidev.ts.
 *
 * Kruti Dev is registered below (Phase 9/10, TODO.md M1 resolved via
 * research — see mappings/krutidev.ts for source attribution).
 */

import { krutidevMapping } from "./mappings/krutidev";

export type ConvertDirection = "kruti_to_unicode" | "unicode_to_kruti";

export type ConvertResult =
  | { ok: true; text: string }
  | { ok: false; reason: "no_mapping_available"; fontId: string };

/** One legacy font's full text-conversion behavior. */
export interface MappingModule {
  fontId: string;
  convert(text: string, direction: ConvertDirection): string;
}

/**
 * Registry of verified mapping modules, keyed by font id. Add a new font by
 * building `mappings/<font-id>.ts` and registering it here — see
 * mappings/README.md for the full checklist (data + fixups + corpus
 * coverage all required before a module counts as usable).
 */
const MAPPING_REGISTRY: Record<string, MappingModule> = {
  krutidev: krutidevMapping,
};

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

  return { ok: true, text: mapping.convert(text, direction) };
}
