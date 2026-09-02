/**
 * Pure, DOM-free logic for the Image Compressor (Phase 6). The actual pixel
 * work happens via Canvas in the client component; this module only knows
 * how to pick a target KB and how to search quality/scale space to hit it,
 * given an injected encoder — so the search loop is unit-testable without a
 * real browser Canvas. See ARCHITECTURE.md § 6/§ 9, PRD.md § 6.1.
 */

export type CompressPreset = "under_100kb" | "under_50kb" | "under_30kb" | "custom";

const PRESET_TARGET_KB: Record<Exclude<CompressPreset, "custom">, number> = {
  under_100kb: 100,
  under_50kb: 50,
  under_30kb: 30,
};

/**
 * Resolves a preset (or custom KB value) to the numeric target in KB.
 * Throws on an invalid custom value rather than silently clamping — the
 * caller (UI) is expected to validate before this is reachable.
 */
export function pickPresetTargetKB(preset: CompressPreset, customKB?: number): number {
  if (preset === "custom") {
    if (!customKB || !Number.isFinite(customKB) || customKB <= 0) {
      throw new Error("customKB must be a positive number for the custom preset");
    }
    return customKB;
  }
  return PRESET_TARGET_KB[preset];
}

export type EncodeAttempt = { quality: number; scale: number };
export type EncodeResult = { sizeKB: number; blob: Blob };
export type Encoder = (attempt: EncodeAttempt) => Promise<EncodeResult>;

export type SearchOutcome =
  | { ok: true; result: EncodeResult; attempt: EncodeAttempt; attempts: number }
  | { ok: false; attempts: number };

const QUALITY_STEPS = [0.92, 0.8, 0.68, 0.56, 0.44, 0.32, 0.2, 0.1];
const SCALE_STEPS = [1, 0.75, 0.5, 0.35, 0.25];

/**
 * Iteratively re-encodes via the injected `encode` function, first walking
 * quality down at full scale, then — if quality alone can't reach the
 * target — downscaling dimensions too. Stops at the first attempt that
 * meets the target; reports failure after exhausting the grid rather than
 * looping forever (no output is better than a silent wrong one).
 *
 * `encode` is injected so this search is testable with a fake encoder;
 * the real encoder (canvas.toBlob-based) lives in the client component.
 */
export async function findCompressionTarget(targetKB: number, encode: Encoder): Promise<SearchOutcome> {
  let attempts = 0;

  for (const scale of SCALE_STEPS) {
    for (const quality of QUALITY_STEPS) {
      attempts += 1;
      const attempt: EncodeAttempt = { quality, scale };
      const result = await encode(attempt);
      if (result.sizeKB <= targetKB) {
        return { ok: true, result, attempt, attempts };
      }
    }
  }

  return { ok: false, attempts };
}
