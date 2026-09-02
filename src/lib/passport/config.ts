/**
 * Passport Photo output configuration.
 *
 * PASSPORT_PHOTO_DIMENSIONS is an UNCONFIRMED PLACEHOLDER pending client
 * sign-off — see TODO.md "M3 — Passport photo dimensions/DPI" and PRD.md
 * § 6.2. The brief does not specify exact output dimensions/DPI. This uses
 * the standard Indian passport photo size (35mm x 45mm) rendered at a
 * round pixel size (~300 DPI) as a reasonable stand-in, matching the exact
 * example given in TODO.md M3. Do not treat this as a spec'd requirement;
 * swap the constant when the client confirms real dimensions.
 */
export const PASSPORT_PHOTO_DIMENSIONS = {
  widthPx: 413,
  heightPx: 531,
} as const;

export const PASSPORT_PHOTO_ASPECT = PASSPORT_PHOTO_DIMENSIONS.widthPx / PASSPORT_PHOTO_DIMENSIONS.heightPx;

/** JPEG quality for the final exported blob (0-1). */
export const PASSPORT_PHOTO_JPEG_QUALITY = 0.92;

/** Client-side upload guardrails — see SECURITY.md § 8 (15 MB recommended cap). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
