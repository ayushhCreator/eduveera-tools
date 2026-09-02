import { describe, expect, it } from "vitest";
import { detectEncoding } from "./detect";

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

  it("never guesses legacy_krutidev — no verified detection exists yet", () => {
    // Arbitrary ASCII/legacy-looking byte sequences must never be classified
    // as legacy_krutidev per AI_RULES.md rule 10 — only 'unicode' or
    // 'unknown' are reachable outcomes right now.
    const samples = ["gsl fH{k;k", "123 !@# ABCxyz", "Ekbdzks lkWQV"];
    for (const sample of samples) {
      expect(detectEncoding(sample)).not.toBe("legacy_krutidev");
    }
  });
});
