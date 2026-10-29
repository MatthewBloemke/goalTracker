export const MOVIE_CASE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_MOVIE_CASE_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_MOVIE_CASE_PROCESSED_BYTES = 5 * 1024 * 1024;

export function getMovieCaseFileError(file: Pick<File, 'size' | 'type'>) {
  if (!MOVIE_CASE_IMAGE_TYPES.includes(file.type as (typeof MOVIE_CASE_IMAGE_TYPES)[number])) {
    return 'Choose a JPEG, PNG, or WebP image.';
  }
  if (file.size <= 0) return 'The selected image is empty.';
  if (file.size > MAX_MOVIE_CASE_SOURCE_BYTES) return 'The original image must be 10 MB or smaller.';
  return null;
}

export function getMovieCaseResizeDimensions(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function prepareMovieCaseImage(file: File) {
  const error = getMovieCaseFileError(file);
  if (error) throw new Error(error);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be opened. Try a JPEG, PNG, or WebP image.');
  }
  try {
    for (const attempt of [
      { maxDimension: 2400, quality: 0.86 },
      { maxDimension: 2100, quality: 0.74 },
      { maxDimension: 1800, quality: 0.66 },
    ]) {
      const blob = await render(bitmap, attempt.maxDimension, attempt.quality);
      if (blob.size <= MAX_MOVIE_CASE_PROCESSED_BYTES) {
        return { data: await blobToBase64(blob), mimeType: 'image/jpeg' };
      }
    }
    throw new Error('The image is still too large after compression. Try a lower-resolution photo.');
  } finally {
    bitmap.close();
  }
}

function render(bitmap: ImageBitmap, maxDimension: number, quality: number) {
  const { width, height } = getMovieCaseResizeDimensions(bitmap.width, bitmap.height, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the movie case image.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Your browser could not compress the image.')),
      'image/jpeg',
      quality,
    );
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Your browser could not read the image.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      if (comma < 0) reject(new Error('Your browser returned an invalid image.'));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}
