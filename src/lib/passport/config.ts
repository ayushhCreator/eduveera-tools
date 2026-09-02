/**
 * Passport Photo output configuration.
 *
 * PASSPORT_PHOTO_DIMENSIONS is CONFIRMED (TODO.md "M3 — Passport photo
 * dimensions/DPI" resolved) against the Government of India Passport Seva
 * portal's own published photo specification: physical print size 35mm x
 * 45mm, digital upload size 630x810px (JPEG, face 80-85% of frame). 630x810
 * is used directly here rather than re-deriving pixels from mm/DPI, since
 * it's the exact digital size Passport Seva itself requires — output from
 * this tool is upload-ready for a real passport application, not just
 * proportionally correct. Source: passportindia.gov.in photo specifications
 * as reflected across multiple photo-compliance vendors (visafoto.com,
 * xpassportphoto.com, passportlayout.online), cross-checked 2026-09-02.
 */
export const PASSPORT_PHOTO_DIMENSIONS = {
  widthPx: 630,
  heightPx: 810,
} as const;

export const PASSPORT_PHOTO_ASPECT = PASSPORT_PHOTO_DIMENSIONS.widthPx / PASSPORT_PHOTO_DIMENSIONS.heightPx;

/** JPEG quality for the final exported blob (0-1). */
export const PASSPORT_PHOTO_JPEG_QUALITY = 0.92;

/** Client-side upload guardrails — see SECURITY.md § 8 (15 MB recommended cap). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
