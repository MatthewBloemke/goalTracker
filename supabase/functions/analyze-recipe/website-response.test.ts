/** @jest-environment node */
import { Readable } from 'node:stream';
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib';
import { readWebsiteResponse, RECIPE_PAGE_MAX_BYTES } from './website-response';

const html = '<p>Butter chicken: ingredients and instructions.</p>';
const signal = () => AbortSignal.timeout(12_000);
function response(bytes: Uint8Array = Buffer.from(html), encoding?: string) {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/html',
      'content-encoding': encoding,
    } as Record<string, string | string[] | undefined>,
    body: Readable.from([bytes.subarray(0, 3), bytes.subarray(3)]),
  };
}

test('reads uncompressed HTML and normalizes raw headers', async () => {
  const raw = response();
  raw.headers['x-fixture'] = ['one', 'two'];
  raw.headers['content-length'] = String(Buffer.byteLength(html));
  const result = await readWebsiteResponse(raw, signal());
  expect(await result.text()).toBe(html);
  expect(result.headers.get('x-fixture')).toBe('one, two');
  expect(result.headers.has('content-length')).toBe(false);
  expect(raw.body.destroyed).toBe(true);
});

test.each([
  ['gzip', gzipSync(Buffer.from(html))],
  ['deflate', deflateSync(Buffer.from(html))],
  [' GZIP ', gzipSync(Buffer.from(html))],
] as const)(
  'decodes unexpected %s using native streams, not Node zlib transforms',
  async (encoding, bytes) => {
    const result = await readWebsiteResponse(
      response(bytes, encoding),
      signal(),
    );
    expect(await result.text()).toBe(html);
    expect(result.headers.has('content-encoding')).toBe(false);
  },
);

test.each(['br', 'zstd', 'gzip, br', 'gzip, gzip'])(
  'rejects unsupported encoding %s before consuming the body',
  async (encoding) => {
    const raw = response(brotliCompressSync(Buffer.from(html)), encoding);
    await expect(readWebsiteResponse(raw, signal())).rejects.toThrow(
      'unsupported compressed response',
    );
    expect(raw.body.readableDidRead).toBe(false);
    expect(raw.body.destroyed).toBe(true);
  },
);

test.each(['gzip', 'deflate'])(
  'turns invalid %s into a normal rejection, with no partial HTML',
  async (encoding) => {
    const raw = response(Buffer.from('not compressed'), encoding);
    await expect(readWebsiteResponse(raw, signal())).rejects.toThrow(
      'invalid compressed data',
    );
    expect(raw.body.destroyed).toBe(true);
  },
);

test('handles asynchronous destroy errors on unread bodies', async () => {
  const raw = response(Buffer.from('not Brotli'), 'br');
  const destroy = raw.body.destroy.bind(raw.body);
  jest
    .spyOn(raw.body, 'destroy')
    .mockImplementation(() => destroy(new Error('Request aborted')));
  await expect(readWebsiteResponse(raw, signal())).rejects.toThrow(
    'unsupported compressed response',
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(raw.body.destroyed).toBe(true);
});

test('rejects truncated gzip even if decoding already yielded some HTML', async () => {
  const compressed = gzipSync(Buffer.from(html));
  await expect(
    readWebsiteResponse(
      response(compressed.subarray(0, compressed.length - 8), 'gzip'),
      signal(),
    ),
  ).rejects.toThrow('invalid compressed data');
});

test('bounds declared and streamed bytes before decompression', async () => {
  const raw = response();
  raw.headers['content-length'] = String(RECIPE_PAGE_MAX_BYTES + 1);
  await expect(readWebsiteResponse(raw, signal())).rejects.toThrow('too large');
  expect(raw.body.readableDidRead).toBe(false);
  expect(raw.body.destroyed).toBe(true);
  const oversized = response(Buffer.alloc(RECIPE_PAGE_MAX_BYTES + 1));
  await expect(readWebsiteResponse(oversized, signal())).rejects.toThrow(
    'too large',
  );
  expect(oversized.body.destroyed).toBe(true);
});

test('bounds decompressed bytes to reject compression bombs', async () => {
  const raw = response(
    gzipSync(Buffer.alloc(RECIPE_PAGE_MAX_BYTES + 1, 'x')),
    'gzip',
  );
  await expect(readWebsiteResponse(raw, signal())).rejects.toThrow('too large');
  expect(raw.body.destroyed).toBe(true);
});

test('allows an HTML body at the exact byte limit', async () => {
  const result = await readWebsiteResponse(
    response(Buffer.alloc(RECIPE_PAGE_MAX_BYTES, 'x')),
    signal(),
  );
  expect((await result.arrayBuffer()).byteLength).toBe(RECIPE_PAGE_MAX_BYTES);
});

test.each([204, 205, 301, 302, 403, 500])(
  'does not decode or consume a %s body',
  async (statusCode) => {
    const raw = { ...response(Buffer.from('not Brotli'), 'br'), statusCode };
    raw.headers.location = 'https://another-public-site.example/recipe';
    const result = await readWebsiteResponse(raw, signal());
    expect(result.status).toBe(statusCode);
    expect(result.body).toBeNull();
    expect(result.headers.get('location')).toBe(
      'https://another-public-site.example/recipe',
    );
    expect(raw.body.readableDidRead).toBe(false);
    expect(raw.body.destroyed).toBe(true);
  },
);

test.each(['video/mp4', undefined])(
  'leaves non-HTML content-type %s for the caller to reject without reading',
  async (type) => {
    const raw = response();
    raw.headers['content-type'] = type;
    const result = await readWebsiteResponse(raw, signal());
    expect(result.body).toBeNull();
    expect(raw.body.destroyed).toBe(true);
  },
);

test('preserves timeout errors and destroys the raw body', async () => {
  const abort = new AbortController();
  const raw = response();
  abort.abort(new DOMException('Deadline exceeded', 'TimeoutError'));
  await expect(readWebsiteResponse(raw, abort.signal)).rejects.toThrow(
    'Deadline exceeded',
  );
  expect(raw.body.destroyed).toBe(true);
});

test('checks the deadline while reading the body', async () => {
  const abort = new AbortController();
  const raw = response();
  raw.body = Readable.from(
    (async function* () {
      abort.abort(new DOMException('Deadline exceeded', 'TimeoutError'));
      yield Buffer.from(html);
    })(),
  );
  await expect(readWebsiteResponse(raw, abort.signal)).rejects.toThrow(
    'Deadline exceeded',
  );
  expect(raw.body.destroyed).toBe(true);
});

test('rejects network body errors and cleans up', async () => {
  const raw = response();
  raw.body = Readable.from(
    (async function* () {
      yield Buffer.from('<p>incomplete');
      throw new Error('network failure');
    })(),
  );
  await expect(readWebsiteResponse(raw, signal())).rejects.toThrow(
    'network failure',
  );
  expect(raw.body.destroyed).toBe(true);
});
