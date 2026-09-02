/**
 * Smart Detection — classifies pasted text as Unicode Devanagari, a known
 * legacy font pattern, or unknown. See PRD.md § 6.4, ARCHITECTURE.md § 8,
 * AI_RULES.md rule 10.
 *
 * Only the Unicode branch is real: Devanagari Unicode codepoints
 * (U+0900–U+097F) are a verifiable fact about the input text, no external
 * data needed. The legacy-font branch requires a verified glyph signature
 * for each font (e.g. Kruti Dev), which does not exist yet (blocked on M1,
 * see TODO.md) — so it is intentionally absent. Do NOT add a heuristic like
 * "mostly ASCII => assume Kruti Dev": arbitrary ASCII is not evidence of any
 * particular legacy encoding, and guessing here is exactly what rule 10
 * forbids. Unrecognized input always returns "unknown".
 */

export type DetectionResult = "unicode" | "legacy_krutidev" | "unknown";

const DEVANAGARI_RANGE = /[ऀ-ॿ]/g;

// ponytail: "meaningful proportion" needs a threshold; 10% of non-whitespace
// characters is an arbitrary-but-reasonable cutoff so a single stray
// Devanagari character in mostly-English text doesn't flip the result.
// Raise/lower if real-world paste samples show it's wrong — no verified
// data drives this number, unlike a legacy glyph signature would.
const UNICODE_PROPORTION_THRESHOLD = 0.1;

export function detectEncoding(text: string): DetectionResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "unknown";

  const devanagariMatches = trimmed.match(DEVANAGARI_RANGE);
  const devanagariCount = devanagariMatches?.length ?? 0;
  if (devanagariCount === 0) return "unknown";

  const nonWhitespaceCount = trimmed.replace(/\s/g, "").length;
  if (nonWhitespaceCount === 0) return "unknown";

  const proportion = devanagariCount / nonWhitespaceCount;
  if (proportion >= UNICODE_PROPORTION_THRESHOLD) return "unicode";

  return "unknown";
}
