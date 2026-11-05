import {
  getReceiptFileError,
  getReceiptResizeDimensions,
  MAX_RECEIPT_PROCESSED_BYTES,
  type PreparedReceiptImage,
} from './receipt';

export async function prepareReceiptImage(
  file: File,
  quarterTurns = 0,
): Promise<PreparedReceiptImage> {
  const fileError = getReceiptFileError(file);
  if (fileError) throw new Error(fileError);

  let bitmap: ImageBitmap;
  try {
    // Apply phone EXIF orientation before any explicit user rotation. The JPEG
    // encoder below then bakes that orientation into the pixels sent to OpenAI.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image could not be opened. Try a JPEG, PNG, or WebP image.');
  }

  try {
    for (const attempt of [
      { maxDimension: 2400, quality: 0.88 },
      { maxDimension: 2200, quality: 0.76 },
      { maxDimension: 1800, quality: 0.68 },
    ]) {
      const { canvas, blob } = await renderReceipt(
        bitmap,
        attempt.maxDimension,
        attempt.quality,
        quarterTurns,
      );
      if (blob.size > 0 && blob.size <= MAX_RECEIPT_PROCESSED_BYTES) {
        return {
          data: await receiptBlobToBase64(blob),
          mimeType: 'image/jpeg',
          width: canvas.width,
          height: canvas.height,
        };
      }
    }
    throw new Error('The receipt is still too large after compression. Try a lower-resolution photo.');
  } finally {
    bitmap.close();
  }
}

async function renderReceipt(
  bitmap: ImageBitmap,
  maxDimension: number,
  quality: number,
  quarterTurns: number,
) {
  const { width, height } = getReceiptResizeDimensions(
    bitmap.width,
    bitmap.height,
    maxDimension,
  );
  const turns = ((quarterTurns % 4) + 4) % 4;
  const canvas = document.createElement('canvas');
  canvas.width = turns % 2 === 0 ? width : height;
  canvas.height = turns % 2 === 0 ? height : width;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the receipt image.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(turns * Math.PI / 2);
  context.drawImage(bitmap, -width / 2, -height / 2, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result
        ? resolve(result)
        : reject(new Error('Your browser could not compress the receipt image.')),
      'image/jpeg',
      quality,
    );
  });
  return { canvas, blob };
}

export function receiptBlobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Your browser could not read the receipt file.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      if (commaIndex < 0) reject(new Error('Your browser returned an invalid receipt file.'));
      else resolve(result.slice(commaIndex + 1));
    };
    reader.readAsDataURL(blob);
  });
}
