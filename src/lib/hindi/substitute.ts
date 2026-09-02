/**
 * Generic ordered-substitution engine shared by legacy-font mapping
 * modules. Not font-specific and holds no data itself (ARCHITECTURE.md §
 * 8) — `mappings/<font>.ts` supplies the ordered table, this just applies
 * it.
 *
 * The table MUST be longest-match/most-specific-first, and every pattern is
 * fully replaced (all occurrences) before moving to the next entry — this
 * mirrors how the source algorithm (see mappings/krutidev.ts for
 * attribution) processes its substitution list. Re-sorting, deduplicating,
 * or converting the table into a plain char-by-char map silently corrupts
 * output for multi-character glyph sequences (e.g. a conjunct's 2-3 char
 * legacy sequence would get partially consumed by an earlier single-char
 * rule).
 */
export function applyOrderedSubstitutions(text: string, table: ReadonlyArray<readonly [string, string]>): string {
  let result = text;
  for (const [from, to] of table) {
    if (from === "") continue;
    result = result.replaceAll(from, to);
  }
  return result;
}
