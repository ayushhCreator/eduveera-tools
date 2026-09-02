import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { convertText } from "../../convert";

const CORPUS_DIR = join(__dirname, "krutidev");

/**
 * Entries where kruti_to_unicode is not expected to exactly reproduce the
 * original Unicode source. This is a fundamental limitation of converting
 * *plain text* Kruti Dev, not a bug in the mapping: Kruti Dev is a
 * single-byte legacy font where every ASCII character maps to *some*
 * Devanagari glyph. Real Kruti Dev documents distinguish embedded English
 * from Hindi via font-run switching (the English portion is set in an
 * ordinary Latin font, only the Hindi portion in Kruti Dev) -- information
 * plain text alone cannot carry. So a legacy-direction string that
 * genuinely contains literal English words is indistinguishable, at the
 * character level, from Kruti Dev codes that happen to look like English
 * letters. See this directory's README "Known limitations" section.
 */
const KRUTI_TO_UNICODE_ROUNDTRIP_EXCEPTIONS = new Set(["07-mixed-hindi-english"]);

/**
 * Entries where unicode_to_kruti is not expected to reproduce the exact
 * legacy byte sequence on file. Not a bug: some rare conjuncts have more
 * than one valid Kruti Dev encoding (a dedicated single-glyph byte code,
 * used here to test that specific code per SIL's spec, vs. this module's
 * general decomposed consonant+virama+consonant path) that render/read
 * identically in the actual font. Entry 08's legacy.txt intentionally uses
 * the dedicated byte codes to exercise them specifically; converting the
 * Unicode side back only needs to produce *a* correct encoding, which is
 * covered separately (see mappings/krutidev.ts header for the round-trip
 * check used to verify the decomposed path for these same sequences).
 */
const UNICODE_TO_KRUTI_EXACT_MATCH_EXCEPTIONS = new Set(["08-rare-conjuncts-sil-sourced"]);

function findPairNames(): string[] {
  const files = readdirSync(CORPUS_DIR);
  const names = new Set(files.filter((f) => f.endsWith(".unicode.txt")).map((f) => f.replace(/\.unicode\.txt$/, "")));
  return [...names].sort();
}

describe("Kruti Dev golden corpus", () => {
  const pairs = findPairNames();

  it("has at least one corpus pair per required coverage category", () => {
    // Sanity guard against the corpus directory silently going empty again.
    expect(pairs.length).toBeGreaterThanOrEqual(7);
  });

  for (const name of pairs) {
    const unicode = readFileSync(join(CORPUS_DIR, `${name}.unicode.txt`), "utf8");
    const legacy = readFileSync(join(CORPUS_DIR, `${name}.legacy.txt`), "utf8");

    if (!UNICODE_TO_KRUTI_EXACT_MATCH_EXCEPTIONS.has(name)) {
      it(`${name}: unicode_to_kruti matches expected legacy output`, () => {
        const result = convertText(unicode, "unicode_to_kruti");
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.text).toBe(legacy);
      });
    }

    if (!KRUTI_TO_UNICODE_ROUNDTRIP_EXCEPTIONS.has(name)) {
      it(`${name}: kruti_to_unicode matches expected unicode output`, () => {
        const result = convertText(legacy, "kruti_to_unicode");
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.text).toBe(unicode);
      });
    }
  }
});
