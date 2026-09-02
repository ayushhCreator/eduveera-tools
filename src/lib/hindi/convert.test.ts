import { describe, expect, it } from "vitest";
import { convertText } from "./convert";

describe("convertText", () => {
  it("returns unsupported (no fabricated output) for kruti_to_unicode — no mapping module registered", () => {
    const result = convertText("dqN Hkh", "kruti_to_unicode");
    expect(result).toEqual({ ok: false, reason: "no_mapping_available", fontId: "krutidev" });
  });

  it("returns unsupported (no fabricated output) for unicode_to_kruti — no mapping module registered", () => {
    const result = convertText("कुछ भी", "unicode_to_kruti");
    expect(result).toEqual({ ok: false, reason: "no_mapping_available", fontId: "krutidev" });
  });

  it("never returns ok: true while the mapping registry is empty, regardless of input", () => {
    const samples = ["", "plain english", "मिश्रित Hindi/English", "12345"];
    for (const text of samples) {
      for (const direction of ["kruti_to_unicode", "unicode_to_kruti"] as const) {
        const result = convertText(text, direction);
        expect(result.ok).toBe(false);
      }
    }
  });
});
