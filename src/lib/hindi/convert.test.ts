import { describe, expect, it } from "vitest";
import { convertText } from "./convert";

describe("convertText", () => {
  it("converts a known Kruti Dev sample to Unicode", () => {
    const result = convertText("dqN Hkh", "kruti_to_unicode");
    expect(result).toEqual({ ok: true, text: "कुछ भी" });
  });

  it("converts Unicode back to the same Kruti Dev sample", () => {
    const result = convertText("कुछ भी", "unicode_to_kruti");
    expect(result).toEqual({ ok: true, text: "dqN Hkh" });
  });

  it("passes plain English/ASCII text through kruti_to_unicode unchanged where the glyphs don't collide with Kruti Dev codes", () => {
    // Digits and whitespace are one-to-one with Kruti Dev's byte set, so
    // this survives; see golden-corpus/krutidev/README.md for the case
    // (mixed Hindi/English letters) where plain text is NOT distinguishable
    // from Kruti Dev codes.
    const result = convertText("12345", "kruti_to_unicode");
    expect(result).toEqual({ ok: true, text: "12345" });
  });

  it("round-trips empty string", () => {
    expect(convertText("", "kruti_to_unicode")).toEqual({ ok: true, text: "" });
    expect(convertText("", "unicode_to_kruti")).toEqual({ ok: true, text: "" });
  });
});
