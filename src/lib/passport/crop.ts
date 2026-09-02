import { PASSPORT_PHOTO_DIMENSIONS, PASSPORT_PHOTO_JPEG_QUALITY } from "@/lib/passport/config";

export type CropArea = { x: number; y: number; width: number; height: number };

/**
 * Loads an image from an object URL. Split out from cropToPassportPhotoBlob
 * so the pixel math below can be unit-tested without a real <img>/Image.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_load_failed"));
    image.src = src;
  });
}

/**
 * Pure function: given react-easy-crop's reported crop area (in source-image
 * pixels), returns the source rect + destination canvas size to draw.
 * Kept separate from any DOM/canvas calls so it's trivially unit-testable.
 *
 * This is also the seam a future A4 multi-copy sheet would reuse: it would
 * draw this same source rect N times onto a larger sheet canvas instead of
 * a single PASSPORT_PHOTO_DIMENSIONS canvas.
 */
export function resolveCropDrawPlan(
  croppedAreaPixels: CropArea,
  outputSize: { widthPx: number; heightPx: number } = PASSPORT_PHOTO_DIMENSIONS,
) {
  return {
    source: croppedAreaPixels,
    destination: { width: outputSize.widthPx, height: outputSize.heightPx },
  };
}

/**
 * Draws the cropped region of `imageSrc` onto an offscreen canvas sized to
 * PASSPORT_PHOTO_DIMENSIONS and resolves a JPEG Blob. Runs entirely in the
 * browser — the original photo is never uploaded (ARCHITECTURE.md § 9).
 */
export async function cropToPassportPhotoBlob(imageSrc: string, croppedAreaPixels: CropArea): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const plan = resolveCropDrawPlan(croppedAreaPixels);

  const canvas = document.createElement("canvas");
  canvas.width = plan.destination.width;
  canvas.height = plan.destination.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unsupported");

  ctx.drawImage(
    image,
    plan.source.x,
    plan.source.y,
    plan.source.width,
    plan.source.height,
    0,
    0,
    plan.destination.width,
    plan.destination.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob_export_failed"))),
      "image/jpeg",
      PASSPORT_PHOTO_JPEG_QUALITY,
    );
  });
}
