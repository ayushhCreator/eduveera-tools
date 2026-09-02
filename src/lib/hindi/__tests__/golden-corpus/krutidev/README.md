# Kruti Dev golden corpus — empty pending verified data

This corpus is currently **empty**. It is blocked on:

- **M1** — a verified Kruti Dev ↔ Unicode glyph mapping table (see
  [`../../mappings/README.md`](../../mappings/README.md)).
- **M2** — real deed sample text, reviewed for PII before being committed
  (see [TODO.md](../../../../../TODO.md) and TESTING.md § 6).

Per AI_RULES.md rule 9, no synthetic/guessed corpus entries are added here to
"fill the directory" — an empty corpus honestly reflects that Kruti Dev
conversion is not implemented yet, matching `convert.ts`'s "unsupported"
result for every input right now.

## Format (once samples exist)

Paired files per test case, so both directions (Kruti Dev → Unicode and
Unicode → Kruti Dev round-trip) can be tested from the same pair:

```
NN-description.legacy.txt    # Kruti Dev source
NN-description.unicode.txt   # expected Unicode output
```

`NN` is a zero-padded sequence number; `description` is a short slug tagging
which coverage category the pair exercises.

## Required coverage categories (TESTING.md § 6)

Every one of these must have at least one corpus pair before Kruti Dev
support is considered usable:

1. **Matras** (vowel signs) — including matras that reorder visually vs.
   logically.
2. **Half letters** (conjunct-forming halant combinations).
3. **Conjuncts** (multi-consonant clusters).
4. **Punctuation** (Devanagari-specific and shared with English, e.g. । and
   ॥).
5. **Numbers** (both Devanagari numerals and Latin digits appearing inside
   Hindi text).
6. **Mixed Hindi/English text** (code-switched sentences, common in real
   deeds — names, addresses, English abbreviations embedded in Hindi text).
7. **Real deed samples** — actual registry/deed document text, not synthetic
   sentences. Each entry must note its source (e.g. "provided by client,
   deed dated X" or "sanitized excerpt from Y") and must be reviewed for PII
   before commit — redact/replace names/addresses/property details with
   realistic placeholders that preserve the same linguistic patterns.
8. **Supported legacy/ASCII-style samples** — text in the specific legacy
   font(s) actually being supported, as opposed to generic/arbitrary ASCII.

## Growth process

Every Hindi conversion bug fix adds a new corpus entry reproducing the bug
before the fix is considered complete (AI_RULES.md rule 12). Corpus only
grows; entries are never deleted, only superseded if a mapping table is
deliberately revised (with a note explaining why). Corpus tests run in CI on
every PR touching `lib/hindi/**` — a single failing entry blocks merge.
