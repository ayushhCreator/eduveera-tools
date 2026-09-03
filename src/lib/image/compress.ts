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

// Highest quality we ever ask for, and the lowest we'll accept before
// preferring to shrink dimensions instead — below ~0.35 JPEG gets visibly
// blocky, and for documents a full-size 0.4 scan beats a half-size 0.9 one.
const MAX_QUALITY = 0.95;
const MIN_QUALITY = 0.4;
const QUALITY_BISECT_ITERS = 6; // ~0.01 quality resolution
const SCALE_STEPS = [1, 0.85, 0.7, 0.55, 0.4, 0.3, 0.22];

/**
 * Finds the **highest-quality** encoding that still fits under `targetKB`,
 * keeping full resolution for as long as possible:
 *
 *  - at each scale, if MAX_QUALITY already fits, take it (can't do better);
 *  - else if MIN_QUALITY still doesn't fit, this scale is hopeless — shrink;
 *  - else binary-search quality for the best that fits at this scale.
 *
 * So a source that's already small keeps near-original quality, and we only
 * downscale once even MIN_QUALITY at the current scale overshoots. Reports
 * failure after exhausting the scale ladder rather than returning a wrong
 * result. `encode` is injected so this stays unit-testable without Canvas.
 */
export async function findCompressionTarget(targetKB: number, encode: Encoder): Promise<SearchOutcome> {
  let attempts = 0;

  for (const scale of SCALE_STEPS) {
    attempts += 1;
    const top = await encode({ quality: MAX_QUALITY, scale });
    if (top.sizeKB <= targetKB) {
      return { ok: true, result: top, attempt: { quality: MAX_QUALITY, scale }, attempts };
    }

    attempts += 1;
    const bottom = await encode({ quality: MIN_QUALITY, scale });
    if (bottom.sizeKB > targetKB) {
      continue; // even the lowest acceptable quality overshoots — go smaller
    }

    let best: { result: EncodeResult; attempt: EncodeAttempt } = {
      result: bottom,
      attempt: { quality: MIN_QUALITY, scale },
    };
    let lo = MIN_QUALITY;
    let hi = MAX_QUALITY;
    for (let i = 0; i < QUALITY_BISECT_ITERS; i += 1) {
      const quality = (lo + hi) / 2;
      attempts += 1;
      const result = await encode({ quality, scale });
      if (result.sizeKB <= targetKB) {
        best = { result, attempt: { quality, scale } };
        lo = quality;
      } else {
        hi = quality;
      }
    }
    return { ok: true, result: best.result, attempt: best.attempt, attempts };
  }

  return { ok: false, attempts };
}
