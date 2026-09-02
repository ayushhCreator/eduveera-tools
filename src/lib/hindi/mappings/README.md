# Mapping data modules

This directory holds one file per supported legacy font — e.g. `krutidev.ts`
would export the glyph-code ↔ Unicode codepoint table for Kruti Dev.

**No mapping module exists yet.** This is blocker **M1** in
[TODO.md](../../../../TODO.md): no verified Kruti Dev ↔ Unicode mapping table
exists anywhere in this repo or in the original brief. Per
[AI_RULES.md](../../../../AI_RULES.md) rule 9, a guessed/approximate table must
never be shipped — the corresponding module stays unimplemented until a
verified source is available (client-provided reference, or a mapping
cross-checked against real deed samples, see blocker **M2**).

## Adding a new font mapping (once verified data exists)

1. Add `mappings/<font-id>.ts` exporting the glyph-code ↔ Unicode table (data
   only — no conversion logic here).
2. Add any font-specific visual-to-logical reordering rules to
   `../reorder.ts` (kept separate from the mapping data itself — see
   ARCHITECTURE.md § 8).
3. Register the module in `../convert.ts`'s mapping registry.
4. Add golden-corpus coverage under `../__tests__/golden-corpus/<font-id>/`
   per TESTING.md § 6 (matras, half letters, conjuncts, punctuation, numbers,
   mixed Hindi/English, real deed samples, legacy/ASCII-style samples) before
   the module is considered usable.

Do not add a mapping module without all four steps — a mapping table without
corpus coverage is exactly the "looks complete but is unverified" failure
mode this structure exists to prevent.
