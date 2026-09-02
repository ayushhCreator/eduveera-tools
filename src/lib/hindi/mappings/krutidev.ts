/**
 * Kruti Dev 010 <-> Unicode Devanagari mapping data.
 *
 * SOURCE (primary, ported near-verbatim): TGNYC/Kriti-Dev-to-Unicode,
 * https://github.com/TGNYC/Kriti-Dev-to-Unicode (krutidevtounicode.js),
 * a working community Node.js converter. The two tables below are its
 * `array_one`/`array_two` ordered substitution lists, extracted
 * programmatically from the original source (not hand-retyped) to avoid
 * transcription errors on combining Devanagari characters, then verified
 * to preserve exact order, length, and content against the original file.
 *
 * LICENSE NOTE: the TGNYC repo has no LICENSE file (confirmed via GitHub
 * API, `"license": null`) -- under default copyright it is technically
 * all-rights-reserved, unlike SIL's silnrsi/wsresources source below
 * (confirmed MIT). Shipped as a known, documented risk per an explicit
 * user decision (2026-09-02) rather than silently assumed safe -- flag for
 * re-review before a larger-scale commercial launch, or if contacting the
 * TGNYC author for explicit permission becomes practical.
 *
 * CROSS-CHECKED (independent oracle) against SIL International's
 * KrutiDev011.map (TECkit format, copyright SIL International 2006),
 * https://github.com/silnrsi/wsresources/blob/master/scripts/Deva/legacy/kruti-dev-011/mappings/KrutiDev011.map
 * -- the formal byte-value-to-Unicode specification for this font. Two
 * systematic (not spot-check) passes were run against it:
 *
 * 1. All 47 base consonant/vowel-sign byte codes in SIL's OneToOneCs/
 *    OneToOneVs classes were programmatically cross-referenced against
 *    this table's single-character entries; every one matched (2 apparent
 *    mismatches on byte 168/169 were confirmed false positives -- those
 *    vowel signs only ever appear here as part of a longer sequence, e.g.
 *    "ks"/"kS", which independently matches SIL's expected output).
 * 2. All 33 explicit multi-character conjunct/stack expansions in SIL's
 *    map (e.g. byte 123 -> KA+VIRAMA+SSA+VIRAMA+ZWJ for क्ष) were run
 *    through this module's full kruti_to_unicode pipeline and compared
 *    against SIL's expected output. 5 conjuncts genuinely missing from
 *    the TGNYC port (bytes 152, 163, 218, 240, 243 -- see the entries
 *    marked "byte NNN" below) were added directly from SIL's verified
 *    expansion. One disagreement remains, deliberately NOT resolved by
 *    guessing: byte 211 ("Ó", a half-form "ya" suffix glyph) -- TGNYC maps
 *    it to "्य" (virama+ya, correct as a *suffix* appended after a base
 *    consonant to form a conjunct, e.g. base+"्य"), SIL's map documents
 *    "य्" (ya+virama) but its own comment notes this was a deliberate
 *    revision from an earlier "virama+ya" mapping to work better inside
 *    SIL's own multi-pass byte-reordering pipeline -- a different
 *    architecture from this module's direct substitution model, so the
 *    two are not necessarily describing the same thing. Left as TGNYC's
 *    original value pending real-text evidence either way (AI_RULES.md
 *    rule 9: disagreements are documented, not silently picked).
 *
 * ORDER IS SEMANTICALLY LOAD-BEARING. Both tables are longest-match /
 * most-specific-first (e.g. conjunct and nukta forms before their plain
 * base-character fallback). Do not sort, deduplicate, or convert to a
 * plain Record<string,string> -- that silently breaks multi-character
 * glyph sequences. Apply via `applyOrderedSubstitutions` (substitute.ts),
 * which preserves this ordering contract.
 *
 * Known limitation: this table plus the reorder fixups in ../reorder.ts
 * faithfully reproduce the TGNYC reference implementation's behavior
 * (verified via round-trip testing against real Hindi text -- see
 * __tests__/golden-corpus/krutidev/) and independently validate against
 * SIL's base character set and explicit conjunct table. Neither source is
 * a client-provided reference or was tested against a real property/
 * registry deed specifically (see TODO.md M2) -- treat as MVP-quality,
 * not court-certified.
 */

import type { MappingModule } from "../convert";
import { krutiToUnicodeFixups, unicodeToKrutiFixups } from "../reorder";
import { applyOrderedSubstitutions } from "../substitute";

export const KRUTI_TO_UNICODE_TABLE: ReadonlyArray<readonly [string, string]> = [
  ["ñ", "॰"],
  ["Q+Z", "QZ+"],
  ["sas", "sa"],
  ["aa", "a"],
  [")Z", "र्द्ध"],
  ["ZZ", "Z"],
  ["‘", "\""],
  ["’", "\""],
  ["“", "'"],
  ["”", "'"],
  ["å", "०"],
  ["ƒ", "१"],
  ["„", "२"],
  ["…", "३"],
  ["†", "४"],
  ["‡", "५"],
  ["ˆ", "६"],
  ["‰", "७"],
  ["Š", "८"],
  ["‹", "९"],
  ["¶+", "फ़्"],
  ["d+", "क़"],
  ["[+k", "ख़"],
  ["[+", "ख़्"],
  ["x+", "ग़"],
  ["T+", "ज़्"],
  ["t+", "ज़"],
  ["M+", "ड़"],
  ["<+", "ढ़"],
  ["Q+", "फ़"],
  [";+", "य़"],
  ["j+", "ऱ"],
  ["u+", "ऩ"],
  ["Ùk", "त्त"],
  ["Ù", "त्त्"],
  ["ä", "क्त"],
  ["–", "दृ"],
  ["—", "कृ"],
  ["é", "न्न"],
  ["™", "न्न्"],
  ["=kk", "=k"],
  ["f=k", "f="],
  ["à", "ह्न"],
  ["á", "ह्य"],
  ["â", "हृ"],
  ["ã", "ह्म"],
  ["ºz", "ह्र"],
  ["º", "ह्"],
  ["í", "द्द"],
  ["{k", "क्ष"],
  ["{", "क्ष्"],
  ["=", "त्र"],
  ["«", "त्र्"],
  ["Nî", "छ्य"],
  ["Vî", "ट्य"],
  ["Bî", "ठ्य"],
  ["Mî", "ड्य"],
  ["<î", "ढ्य"],
  ["|", "द्य"],
  ["K", "ज्ञ"],
  ["}", "द्व"],
  ["J", "श्र"],
  ["Vª", "ट्र"],
  ["Mª", "ड्र"],
  ["<ªª", "ढ्र"],
  ["Nª", "छ्र"],
  ["Ø", "क्र"],
  ["Ý", "फ्र"],
  ["nzZ", "र्द्र"],
  ["æ", "द्र"],
  ["ç", "प्र"],
  ["Á", "प्र"],
  ["xz", "ग्र"],
  // The 5 entries below are NOT from TGNYC's table -- a systematic
  // cross-check of every explicit conjunct/stack byte in SIL's
  // KrutiDev011.map (see module header) against this table found these 5
  // rare conjunct byte codes genuinely missing from the TGNYC port. Added
  // directly from SIL's own verified expansion (not guessed), each
  // producing the single Devanagari sequence SIL specifies for that byte:
  ["˜", "द्भ"], // byte 152 (CP1252 0x98) -- SIL: "dbha"
  ["£", "ख्र"], // byte 163 -- SIL: KHA VIRAMA RA
  ["Ú", "र्"], // byte 218 -- SIL: RA VIRAMA (alternate reph glyph)
  ["ð", "ठ्ठ"], // byte 240 -- SIL: TTHA VIRAMA TTHA
  ["ó", "स्त्र"], // byte 243 -- SIL: SA VIRAMA ZWJ TA VIRAMA RA
  ["#", "रु"],
  [":", "रू"],
  ["v‚", "ऑ"],
  ["vks", "ओ"],
  ["vkS", "औ"],
  ["vk", "आ"],
  ["v", "अ"],
  ["b±", "ईं"],
  ["Ã", "ई"],
  ["bZ", "ई"],
  ["b", "इ"],
  ["m", "उ"],
  ["Å", "ऊ"],
  [",s", "ऐ"],
  [",", "ए"],
  ["_", "ऋ"],
  ["ô", "क्क"],
  ["d", "क"],
  ["Dk", "क"],
  ["D", "क्"],
  ["[k", "ख"],
  ["[", "ख्"],
  ["x", "ग"],
  ["Xk", "ग"],
  ["X", "ग्"],
  ["Ä", "घ"],
  ["?k", "घ"],
  ["?", "घ्"],
  ["³", "ङ"],
  ["pkS", "चै"],
  ["p", "च"],
  ["Pk", "च"],
  ["P", "च्"],
  ["N", "छ"],
  ["t", "ज"],
  ["Tk", "ज"],
  ["T", "ज्"],
  [">", "झ"],
  ["÷", "झ्"],
  ["¥", "ञ"],
  ["ê", "ट्ट"],
  ["ë", "ट्ठ"],
  ["V", "ट"],
  ["B", "ठ"],
  ["ì", "ड्ड"],
  ["ï", "ड्ढ"],
  ["M+", "ड़"],
  ["<+", "ढ़"],
  ["M", "ड"],
  ["<", "ढ"],
  [".k", "ण"],
  [".", "ण्"],
  ["r", "त"],
  ["Rk", "त"],
  ["R", "त्"],
  ["Fk", "थ"],
  ["F", "थ्"],
  [")", "द्ध"],
  ["n", "द"],
  ["/k", "ध"],
  ["èk", "ध"],
  ["/", "ध्"],
  ["Ë", "ध्"],
  ["è", "ध्"],
  ["u", "न"],
  ["Uk", "न"],
  ["U", "न्"],
  ["i", "प"],
  ["Ik", "प"],
  ["I", "प्"],
  ["Q", "फ"],
  ["¶", "फ्"],
  ["c", "ब"],
  ["Ck", "ब"],
  ["C", "ब्"],
  ["Hk", "भ"],
  ["H", "भ्"],
  ["e", "म"],
  ["Ek", "म"],
  ["E", "म्"],
  [";", "य"],
  ["¸", "य्"],
  ["j", "र"],
  ["y", "ल"],
  ["Yk", "ल"],
  ["Y", "ल्"],
  ["G", "ळ"],
  ["o", "व"],
  ["Ok", "व"],
  ["O", "व्"],
  ["'k", "श"],
  ["'", "श्"],
  ["\"k", "ष"],
  ["\"", "ष्"],
  ["l", "स"],
  ["Lk", "स"],
  ["L", "स्"],
  ["g", "ह"],
  ["È", "ीं"],
  ["z", "्र"],
  ["Ì", "द्द"],
  ["Í", "ट्ट"],
  ["Î", "ट्ठ"],
  ["Ï", "ड्ड"],
  ["Ñ", "कृ"],
  ["Ò", "भ"],
  ["Ó", "्य"],
  ["Ô", "ड्ढ"],
  ["Ö", "झ्"],
  ["Ø", "क्र"],
  ["Ù", "त्त्"],
  ["Ük", "श"],
  ["Ü", "श्"],
  ["‚", "ॉ"],
  ["ks", "ो"],
  ["kS", "ौ"],
  ["k", "ा"],
  ["h", "ी"],
  ["q", "ु"],
  ["w", "ू"],
  ["`", "ृ"],
  ["s", "े"],
  ["S", "ै"],
  ["a", "ं"],
  ["¡", "ँ"],
  ["%", "ः"],
  ["W", "ॅ"],
  ["•", "ऽ"],
  ["·", "ऽ"],
  ["∙", "ऽ"],
  ["·", "ऽ"],
  ["~j", "्र"],
  ["~", "्"],
  ["\\", "?"],
  ["+", "़"],
  [" ः", ":"],
  ["^", "‘"],
  ["*", "’"],
  ["Þ", "“"],
  ["ß", "”"],
  ["(", ";"],
  ["¼", "("],
  ["½", ")"],
  ["¿", "{"],
  ["À", "}"],
  ["¾", "="],
  ["A", "।"],
  ["-", "."],
  ["&", "-"],
  ["&", "µ"],
  ["Œ", "॰"],
  ["]", ","],
  ["~ ", "् "],
  ["@", "/"],
];

export const UNICODE_TO_KRUTI_TABLE: ReadonlyArray<readonly [string, string]> = [
  ["‘", "^"],
  ["’", "*"],
  ["“", "Þ"],
  ["”", "ß"],
  ["(", "¼"],
  [")", "½"],
  ["{", "¿"],
  ["}", "À"],
  ["=", "¾"],
  ["।", "A"],
  ["?", "\\"],
  ["-", "&"],
  ["µ", "&"],
  ["॰", "Œ"],
  [",", "]"],
  [".", "-"],
  ["् ", "~ "],
  ["०", "å"],
  ["१", "ƒ"],
  ["२", "„"],
  ["३", "…"],
  ["४", "†"],
  ["५", "‡"],
  ["६", "ˆ"],
  ["७", "‰"],
  ["८", "Š"],
  ["९", "‹"],
  ["x", "Û"],
  ["फ़्", "¶"],
  ["क़", "d"],
  ["ख़", "[k"],
  ["ग़", "x"],
  ["ज़्", "T"],
  ["ज़", "t"],
  ["ड़", "M+"],
  ["ढ़", "<+"],
  ["फ़", "Q"],
  ["य़", ";"],
  ["ऱ", "j"],
  ["ऩ", "u"],
  ["त्त्", "Ù"],
  ["त्त", "Ùk"],
  ["क्त", "ä"],
  ["दृ", "–"],
  ["कृ", "—"],
  ["ह्न", "à"],
  ["ह्य", "á"],
  ["हृ", "â"],
  ["ह्म", "ã"],
  ["ह्र", "ºz"],
  ["ह्", "º"],
  ["द्द", "í"],
  ["क्ष्", "{"],
  ["क्ष", "{k"],
  ["त्र्", "«"],
  ["त्र", "="],
  ["ज्ञ", "K"],
  ["छ्य", "Nî"],
  ["ट्य", "Vî"],
  ["ठ्य", "Bî"],
  ["ड्य", "Mî"],
  ["ढ्य", "<î"],
  ["द्य", "|"],
  ["द्व", "}"],
  ["श्र", "J"],
  ["ट्र", "Vª"],
  ["ड्र", "Mª"],
  ["ढ्र", "<ªª"],
  ["छ्र", "Nª"],
  ["क्र", "Ø"],
  ["फ्र", "Ý"],
  ["द्र", "æ"],
  ["प्र", "ç"],
  ["ग्र", "xz"],
  ["रु", "#"],
  ["रू", ":"],
  ["्र", "z"],
  ["ओ", "vks"],
  ["औ", "vkS"],
  ["आ", "vk"],
  ["अ", "v"],
  ["ई", "bZ"],
  ["इ", "b"],
  ["उ", "m"],
  ["ऊ", "Å"],
  ["ऐ", ",s"],
  ["ए", ","],
  ["ऋ", "_"],
  ["क्", "D"],
  ["क", "d"],
  ["क्क", "ô"],
  ["ख्", "["],
  ["ख", "[k"],
  ["ग्", "X"],
  ["ग", "x"],
  ["घ्", "?"],
  ["घ", "?k"],
  ["ङ", "³"],
  ["चै", "pkS"],
  ["च्", "P"],
  ["च", "p"],
  ["छ", "N"],
  ["ज्", "T"],
  ["ज", "t"],
  ["झ्", "÷"],
  ["झ", ">"],
  ["ञ", "¥"],
  ["ट्ट", "ê"],
  ["ट्ठ", "ë"],
  ["ट", "V"],
  ["ठ", "B"],
  ["ड्ड", "ì"],
  ["ड्ढ", "ï"],
  ["ड", "M"],
  ["ढ", "<"],
  ["ण्", "."],
  ["ण", ".k"],
  ["त्", "R"],
  ["त", "r"],
  ["थ्", "F"],
  ["थ", "Fk"],
  ["द्ध", ")"],
  ["द", "n"],
  ["ध्", "/"],
  ["ध", "/k"],
  ["न्", "U"],
  ["न", "u"],
  ["प्", "I"],
  ["प", "i"],
  ["फ्", "¶"],
  ["फ", "Q"],
  ["ब्", "C"],
  ["ब", "c"],
  ["भ्", "H"],
  ["भ", "Hk"],
  ["म्", "E"],
  ["म", "e"],
  ["य्", "¸"],
  ["य", ";"],
  ["र", "j"],
  ["ल्", "Y"],
  ["ल", "y"],
  ["ळ", "G"],
  ["व्", "O"],
  ["व", "o"],
  ["श्", "'"],
  ["श", "'k"],
  ["ष्", "\""],
  ["ष", "\"k"],
  ["स्", "L"],
  ["स", "l"],
  ["ह", "g"],
  ["ऑ", "v‚"],
  ["ॉ", "‚"],
  ["ो", "ks"],
  ["ौ", "kS"],
  ["ा", "k"],
  ["ी", "h"],
  ["ु", "q"],
  ["ू", "w"],
  ["ृ", "`"],
  ["े", "s"],
  ["ै", "S"],
  ["ं", "a"],
  ["ँ", "¡"],
  ["ः", "%"],
  ["ॅ", "W"],
  ["ऽ", "·"],
  ["् ", "~ "],
  ["्", "~"],
];

/**
 * Ordered pipeline per direction, matching the source algorithm's exact
 * step order (see reorder.ts for why the fixups run before/after the
 * substitution table depending on direction):
 *   - kruti_to_unicode: substitute glyphs first, then fix up the handful
 *     of positional glyphs (ikar, reph, special compounds) the
 *     substitution table can't express.
 *   - unicode_to_kruti: fix up positional glyphs first (so they turn into
 *     the "f"/"Z" ASCII markers the substitution table will then ignore),
 *     then substitute the remaining Unicode characters into legacy glyphs.
 */
export const krutidevMapping: MappingModule = {
  fontId: "krutidev",
  convert(text, direction) {
    if (direction === "kruti_to_unicode") {
      const substituted = applyOrderedSubstitutions(text, KRUTI_TO_UNICODE_TABLE);
      return krutiToUnicodeFixups(substituted);
    }
    const fixedUp = unicodeToKrutiFixups(text);
    return applyOrderedSubstitutions(fixedUp, UNICODE_TO_KRUTI_TABLE);
  },
};
