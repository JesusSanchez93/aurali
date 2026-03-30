/**
 * Crops an HTMLImageElement to the given pixel crop region and returns a
 * base64 data URL of the result (default: PNG).
 */
export function cropImageToBase64(
  image: HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
  mimeType = 'image/png',
): string {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL(mimeType);
}
