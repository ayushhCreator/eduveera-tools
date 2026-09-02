import { describe, expect, it } from "vitest";
import { findCompressionTarget, pickPresetTargetKB, type Encoder } from "./compress";

describe("pickPresetTargetKB", () => {
  it("resolves the fixed presets", () => {
    expect(pickPresetTargetKB("under_100kb")).toBe(100);
    expect(pickPresetTargetKB("under_50kb")).toBe(50);
    expect(pickPresetTargetKB("under_30kb")).toBe(30);
  });

  it("resolves custom to the given KB value", () => {
    expect(pickPresetTargetKB("custom", 42)).toBe(42);
  });

  it("rejects a missing/invalid custom value", () => {
    expect(() => pickPresetTargetKB("custom")).toThrow();
    expect(() => pickPresetTargetKB("custom", 0)).toThrow();
    expect(() => pickPresetTargetKB("custom", -5)).toThrow();
    expect(() => pickPresetTargetKB("custom", NaN)).toThrow();
  });
});

describe("findCompressionTarget", () => {
  it("returns the first attempt that meets the target", async () => {
    const encode: Encoder = async ({ quality, scale }) => ({
      sizeKB: quality * scale * 200,
      blob: new Blob(),
    });

    const outcome = await findCompressionTarget(100, encode);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.sizeKB).toBeLessThanOrEqual(100);
      expect(outcome.attempts).toBeGreaterThan(0);
    }
  });

  it("falls back to downscaling when quality alone can't reach target", async () => {
    // Size only shrinks once scale drops below 1 — quality-only steps at
    // scale=1 must all fail before a downscaled attempt can succeed.
    const encode: Encoder = async ({ quality, scale }) => ({
      sizeKB: scale < 1 ? 10 : 1000 * quality,
      blob: new Blob(),
    });

    const outcome = await findCompressionTarget(50, encode);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.attempt.scale).toBeLessThan(1);
    }
  });

  it("reports failure after exhausting the grid without ever claiming false success", async () => {
    const encode: Encoder = async () => ({ sizeKB: 999, blob: new Blob() });

    const outcome = await findCompressionTarget(10, encode);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.attempts).toBeGreaterThan(0);
    }
  });
});
