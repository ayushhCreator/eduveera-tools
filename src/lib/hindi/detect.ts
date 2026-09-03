/**
 * Smart Detection — classifies pasted text as Unicode Devanagari, a known
 * legacy font pattern (Kruti Dev), or unknown. See PRD.md § 6.4,
 * ARCHITECTURE.md § 8, AI_RULES.md rules 10–11.
 *
 * Unicode branch: Devanagari codepoints (U+0900–U+097F) are a verifiable
 * fact about the input — no external data needed.
 *
 * Kruti Dev branch: derived directly from KRUTI_TO_UNICODE_TABLE (the
 * verified, sourced mapping table in mappings/krutidev.ts). Every source-side
 * character in that table with charCode >= 0x80 (the CP1252 extended range,
 * Alt+128 and above) is an unambiguous Kruti Dev glyph — a Windows CP1252
 * byte that is repurposed as a Devanagari glyph code and would never appear
 * in normal Latin or English text. The indiatyping.com Alt-code chart
 * (retrieved 2026-09-03) independently confirms this: every glyph the chart
 * shows at Alt+128 and above corresponds to entries in KRUTI_TO_UNICODE_TABLE.
 * A single such character in otherwise non-Devanagari text is sufficient
 * evidence — no proportion threshold is needed because these bytes are
 * structurally impossible in plain Latin text.
 *
 * AI_RULES.md rule 10 compliance: no character is added to the signature
 * that isn't already in the verified mapping table. The detector does NOT
 * attempt to classify plain ASCII text (Alt+033–127) as Kruti Dev — those
 * bytes are shared with Latin characters and would be a guess. The only
 * reliable Kruti Dev signature is the presence of extended-range bytes from
 * the known table. Unrecognized input always returns "unknown".
 */

import { KRUTI_TO_UNICODE_TABLE } from "./mappings/krutidev";

export type DetectionResult = "unicode" | "legacy_krutidev" | "unknown";

const DEVANAGARI_RANGE = /[ऀ-ॿ]/g;

// ponytail: "meaningful proportion" needs a threshold; 10% of non-whitespace
// characters is an arbitrary-but-reasonable cutoff so a single stray
// Devanagari character in mostly-English text doesn't flip the result.
const UNICODE_PROPORTION_THRESHOLD = 0.1;

/**
 * Signature set derived at module load from KRUTI_TO_UNICODE_TABLE.
 *
 * We collect every source-side character whose charCode is outside the
 * standard printable ASCII range (U+0020–U+007E). This covers two groups:
 *
 *   1. CP1252 bytes 0x80–0xFF: repurposed as Devanagari consonant/vowel glyphs
 *      (e.g. À=0xC0 → प्र, å=0xE5 → ०). These are the bulk of the signature.
 *
 *   2. CP1252-extended Unicode codepoints above 0xFF: CP1252 maps its bytes
 *      0x80–0x9F to named Unicode characters outside the Latin-1 range — e.g.
 *      byte 0x83 → ƒ (U+0192), byte 0x84 → „ (U+201E), byte 0x85 → … (U+2026).
 *      The TGNYC source table stores them as these Unicode codepoints, so they
 *      appear here as values > 0xFF. Used for Devanagari numerals in the table.
 *
 * All characters in this set come directly from the verified mapping table —
 * nothing is guessed (AI_RULES.md rule 10). Characters in the standard
 * printable ASCII range (space through ~) are NOT included because they're
 * shared with Latin text and would make the detector unreliable.
 */
const KRUTI_SIGNATURE_CHARS: ReadonlySet<string> = (() => {
  const chars = new Set<string>();
  for (const [src] of KRUTI_TO_UNICODE_TABLE) {
    for (const ch of src) {
      // Exclude standard printable ASCII (U+0020–U+007E); include everything else.
      const code = ch.charCodeAt(0);
      if (code < 0x20 || code > 0x7e) {
        chars.add(ch);
      }
    }
  }
  return chars;
})();

/**
 * Returns true if `text` contains at least one character from the verified
 * Kruti Dev extended-ASCII signature set.
 */
function hasKrutiSignatureChar(text: string): boolean {
  for (const ch of text) {
    if (KRUTI_SIGNATURE_CHARS.has(ch)) return true;
  }
  return false;
}

export function detectEncoding(text: string): DetectionResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "unknown";

  // --- Unicode Devanagari check ---
  const devanagariMatches = trimmed.match(DEVANAGARI_RANGE);
  const devanagariCount = devanagariMatches?.length ?? 0;

  if (devanagariCount > 0) {
    const nonWhitespaceCount = trimmed.replace(/\s/g, "").length;
    if (nonWhitespaceCount === 0) return "unknown";
    const proportion = devanagariCount / nonWhitespaceCount;
    if (proportion >= UNICODE_PROPORTION_THRESHOLD) return "unicode";
    // Has some Devanagari but below threshold — fall through to unknown;
    // mixing Devanagari with Kruti Dev extended bytes in the same string is
    // an edge case we intentionally don't classify (can't reliably pick one).
    return "unknown";
  }

  // --- Kruti Dev extended-byte check ---
  // No Devanagari. If any character matches the verified extended-ASCII
  // signature, classify as legacy_krutidev. This is NOT a guess — it is a
  // direct consequence of the verified mapping table (AI_RULES.md rule 10).
  if (hasKrutiSignatureChar(trimmed)) return "legacy_krutidev";

  return "unknown";
}
