// Recipe pages can contain over 1 MB of comments/markup even when the recipe
// itself is short. This is separate from the 16,000-character AI input cap.
export const RECIPE_PAGE_MAX_BYTES = 2_000_000;

// Only these static messages may be returned to the browser.
export class RecipeWebsiteError extends Error {}

type RawWebsiteResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array> & {
    destroy: () => unknown;
    on: (event: 'error', listener: (error: Error) => void) => unknown;
  };
};

function tooLarge(): never {
  throw new RecipeWebsiteError(
    'Source is too large. Paste just the recipe text instead.',
  );
}

function combine(chunks: Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

// Use the raw request body, never Undici.fetch's automatic Node/zlib decoder.
// Deno 2.1.4's Brotli Transform can throw outside the request's try/catch,
// terminating the worker and dropping the CORS response entirely.
export async function readWebsiteResponse(
  raw: RawWebsiteResponse,
  signal: AbortSignal,
): Promise<Response> {
  // Undici emits an asynchronous AbortError when an unread body is destroyed
  // (redirects, unsupported encodings, oversized responses). Handle that event
  // even when no iterator was started. Iteration still rejects on read errors.
  raw.body.on('error', () => {});
  try {
    signal.throwIfAborted();
    const headers = new Headers();
    for (const [name, value] of Object.entries(raw.headers)) {
      if (value !== undefined) {
        for (const item of Array.isArray(value) ? value : [value])
          headers.append(name, item);
      }
    }
    // No need to read/decompress redirect, error or non-HTML bodies. The caller
    // validates each redirect destination and handles status/content-type errors.
    if (
      raw.statusCode < 200 ||
      raw.statusCode >= 300 ||
      raw.statusCode === 204 ||
      raw.statusCode === 205 ||
      !headers.get('content-type')?.toLowerCase().includes('text/html')
    ) {
      return new Response(null, { status: raw.statusCode, headers });
    }
    const encoding = (headers.get('content-encoding') ?? 'identity')
      .trim()
      .toLowerCase();
    if (!['identity', 'gzip', 'deflate'].includes(encoding)) {
      throw new RecipeWebsiteError(
        'This website sent an unsupported compressed response. Paste its recipe text instead.',
      );
    }
    if (Number(headers.get('content-length')) > RECIPE_PAGE_MAX_BYTES)
      tooLarge();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of raw.body) {
      signal.throwIfAborted();
      size += chunk.byteLength;
      if (size > RECIPE_PAGE_MAX_BYTES) tooLarge();
      chunks.push(chunk);
    }
    signal.throwIfAborted();
    let bytes = combine(chunks, size);
    if (encoding === 'gzip' || encoding === 'deflate') {
      // Some servers ignore Accept-Encoding: identity. Support these formats
      // using native Web Streams, not Node's decompression transforms.
      const stream = new Response(
        bytes.buffer as ArrayBuffer,
      ).body!.pipeThrough(new DecompressionStream(encoding));
      const reader = stream.getReader();
      const decoded: Uint8Array[] = [];
      let decodedSize = 0;
      try {
        while (true) {
          signal.throwIfAborted();
          const { done, value } = await reader.read();
          if (done) break;
          decodedSize += value.byteLength;
          if (decodedSize > RECIPE_PAGE_MAX_BYTES) tooLarge();
          decoded.push(value);
        }
        bytes = combine(decoded, decodedSize);
      } catch (error) {
        signal.throwIfAborted();
        if (error instanceof RecipeWebsiteError) throw error;
        throw new RecipeWebsiteError(
          'This website sent invalid compressed data. Paste its recipe text instead.',
        );
      } finally {
        // An errored stream can reject cancel too; preserve the original error.
        await reader.cancel().catch(() => {});
      }
    }
    signal.throwIfAborted();
    headers.delete('content-encoding');
    headers.delete('content-length');
    return new Response(bytes.buffer as ArrayBuffer, {
      status: raw.statusCode,
      headers,
    });
  } finally {
    raw.body.destroy();
  }
}
