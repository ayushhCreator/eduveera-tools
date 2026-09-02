# Mapping data modules

This directory holds one file per supported legacy font's glyph-code ↔
Unicode codepoint table.

## Kruti Dev — resolved (TODO.md blocker **M1**)

`krutidev.ts` exports the Kruti Dev 010 ↔ Unicode ordered substitution
tables, sourced from two independent, cross-checked references (see the
file's own header comment for full detail):

1. **Primary, ported near-verbatim**: [TGNYC/Kriti-Dev-to-Unicode](https://github.com/TGNYC/Kriti-Dev-to-Unicode)
   — a working community Node.js converter. Extracted programmatically from
   the original source (never hand-retyped) to avoid transcription errors
   on combining Devanagari characters.
2. **Cross-checked (independent oracle)**: SIL International's
   [KrutiDev011.map](https://github.com/silnrsi/wsresources/blob/master/scripts/Deva/legacy/kruti-dev-011/mappings/KrutiDev011.map)
   (TECkit format, copyright SIL International 2006) — the formal
   byte-value specification for this font. All 47 base consonant/vowel-sign
   byte codes were programmatically cross-referenced against this table;
   every one matched.

Verified via round-trip testing against a real, independently-generated
Hindi text sample (not authored for this test — see
`../__tests__/golden-corpus/krutidev/README.md`) plus a set of well-known
Hindi words covering major conjuncts, reph, and matras.

**Known limitation**: neither source is a client-provided reference, and
neither was tested against a real property/registry deed specifically
(TODO.md **M2** — real deed text was not obtainable; see the golden-corpus
README for what was substituted and why). Treat this mapping as
MVP-quality — verified against two independent sources and real text, not
court-certified or client-approved.

## Adding a new font mapping

1. Add `mappings/<font-id>.ts` exporting the ordered glyph ↔ Unicode
   substitution table(s) (data — cite sources in a header comment, do not
   fabricate, AI_RULES.md rule 9) plus a `MappingModule` implementation
   (see `convert.ts`'s `MappingModule` interface — each module owns its
   full text transform, since real legacy-font algorithms typically
   interleave substitution and position-fixing in ways a generic
   "map-then-reorder" pipeline can't express without corrupting
   multi-character glyphs).
2. Add any font-specific position-fixing logic to `../reorder.ts`, kept
   separate from the mapping data itself (ARCHITECTURE.md § 8).
3. Register the module in `../convert.ts`'s `MAPPING_REGISTRY`.
4. Add golden-corpus coverage under `../__tests__/golden-corpus/<font-id>/`
   per TESTING.md § 6 (matras, half letters, conjuncts, punctuation,
   numbers, mixed Hindi/English, real deed samples, legacy/ASCII-style
   samples) before the module is considered usable.

Do not add a mapping module without all four steps — a mapping table
without corpus coverage is exactly the "looks complete but is unverified"
failure mode this structure exists to prevent.
