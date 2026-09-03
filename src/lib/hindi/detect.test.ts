import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { detectEncoding } from "./detect";

const CORPUS_DIR = join(
  __dirname,
  "__tests__/golden-corpus/krutidev"
);

function readCorpus(name: string) {
  return readFileSync(join(CORPUS_DIR, name), "utf8").trim();
}

// Corpus files read from disk — extended bytes are guaranteed present because
// these are the same files the golden-corpus round-trip tests already pass on.
const CORPUS_ENTRY_01 = readCorpus("01-real-text-wells-for-india.legacy.txt");
const CORPUS_ENTRY_02 = readCorpus("02-matras.legacy.txt");  // contains ¡ (0xA1)
const CORPUS_ENTRY_06 = readCorpus("06-numbers.legacy.txt"); // contains ƒ„… (0x83–0x85)
const CORPUS_ENTRY_08 = readCorpus("08-rare-conjuncts-sil-sourced.legacy.txt");

describe("detectEncoding", () => {
  it("classifies clearly-Unicode Devanagari text as unicode", () => {
    expect(detectEncoding("नमस्ते दुनिया")).toBe("unicode");
    expect(detectEncoding("यह एक हिंदी वाक्य है।")).toBe("unicode");
  });

  it("classifies plain English ASCII as unknown", () => {
    expect(detectEncoding("Hello world, this is English text.")).toBe("unknown");
  });

  it("classifies empty or whitespace-only input as unknown", () => {
    expect(detectEncoding("")).toBe("unknown");
    expect(detectEncoding("   \n\t  ")).toBe("unknown");
  });

  // --- Kruti Dev positive detection (real corpus files) ---

  it("classifies real Kruti Dev corpus entry 01 (full paragraph) as legacy_krutidev", () => {
    expect(detectEncoding(CORPUS_ENTRY_01)).toBe("legacy_krutidev");
  });

  it("classifies corpus entry 02 (matras — contains ¡ 0xA1) as legacy_krutidev", () => {
    expect(detectEncoding(CORPUS_ENTRY_02)).toBe("legacy_krutidev");
  });

  it("classifies corpus entry 06 (numbers — contains ƒ„… 0x83–0x85) as legacy_krutidev", () => {
    expect(detectEncoding(CORPUS_ENTRY_06)).toBe("legacy_krutidev");
  });

  it("classifies corpus entry 08 (rare SIL conjuncts) as legacy_krutidev", () => {
    expect(detectEncoding(CORPUS_ENTRY_08)).toBe("legacy_krutidev");
  });

  // --- Non-detection: pure ASCII must stay unknown (AI_RULES.md rule 10) ---

  it("does not classify pure ASCII (no extended bytes) as legacy_krutidev", () => {
    // Pure ASCII Kruti Dev text (lowercase latin only, no extended bytes)
    // stays 'unknown' — we can't distinguish it from English per AI_RULES.md
    // rule 10. Only extended-byte presence (≥0x80) is reliable.
    const pureAsciiSamples = ["gsl fH{k;k", "123 !@# ABCxyz", "Ekbdzks lkWQV"];
    for (const sample of pureAsciiSamples) {
      expect(detectEncoding(sample)).toBe("unknown");
    }
  });

  it("never guesses legacy_krutidev on pure ASCII — rule 10 guard", () => {
    // Belt-and-suspenders guard preserved from before the detector was built
    // to document the ASCII-only case is still intentionally not classified.
    const samples = ["gsl fH{k;k", "123 !@# ABCxyz", "Ekbdzks lkWQV"];
    for (const sample of samples) {
      expect(detectEncoding(sample)).not.toBe("legacy_krutidev");
    }
  });
});
