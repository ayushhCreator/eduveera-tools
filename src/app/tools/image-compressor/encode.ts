"use client";

/**
 * DOM-bound Canvas encoder — the real `Encoder` passed to
 * `findCompressionTarget` (src/lib/image/compress.ts). Kept separate from
 * that pure module so the search logic stays unit-testable without a real
 * Canvas/Image, per ARCHITECTURE.md § 9 (client-side only, no upload).
 */
import type { EncodeAttempt, EncodeResult } from "@/lib/image/compress";

export async function loadImageBitmap(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("could not read image"));
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function makeCanvasEncoder(img: HTMLImageElement): (attempt: EncodeAttempt) => Promise<EncodeResult> {
  return async ({ quality, scale }) => {
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas not supported");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("compression failed");

    return { sizeKB: blob.size / 1024, blob };
  };
}
