export type ProcessedImage = {
  id: string;
  fullBlob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
  previewUrl: string;
};

const FULL_MAX_WIDTH = 2000;
const THUMB_MAX_WIDTH = 400;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

function drawScaled(
  img: HTMLImageElement,
  maxWidth: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  // Re-drawing through a canvas drops all EXIF metadata (incl. GPS).
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

function toWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encode failed."))),
      "image/webp",
      quality,
    );
  });
}

/**
 * Process a user-selected image entirely in the browser: strip EXIF, convert to
 * WebP, and emit a full image (≤2000px wide) plus a 400px thumbnail. Nothing is
 * uploaded here — that happens on submit.
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  const img = await loadImage(file);
  const full = drawScaled(img, FULL_MAX_WIDTH);
  const thumb = drawScaled(img, THUMB_MAX_WIDTH);
  const [fullBlob, thumbBlob] = await Promise.all([
    toWebp(full.canvas, 0.82),
    toWebp(thumb.canvas, 0.8),
  ]);
  return {
    id: crypto.randomUUID(),
    fullBlob,
    thumbBlob,
    width: full.width,
    height: full.height,
    previewUrl: URL.createObjectURL(fullBlob),
  };
}
