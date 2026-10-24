// Run with Deno 2.1.4 (the reported Edge Runtime compatibility version):
// deno run --allow-net=127.0.0.1 --allow-env scripts/test-recipe-http.mjs
// Local HTTP fixtures only: no Supabase credentials or OpenAI requests.
import assert from 'node:assert/strict';
import { Client } from 'npm:undici@6.29.1';
import { readWebsiteResponse } from '../supabase/functions/analyze-recipe/website-response.ts';

const html = '<p>Butter chicken recipe ingredients and instructions.</p>';
const gzip = new Uint8Array(
  await new Response(
    new Blob([html]).stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer(),
);
const cases = new Map([
  ['/identity', { body: html }],
  ['/gzip', { body: gzip, encoding: 'gzip' }],
  [
    '/broken-gzip',
    { body: 'not gzip', encoding: 'gzip', error: 'invalid compressed data' },
  ],
  [
    '/truncated-gzip',
    {
      body: gzip.subarray(0, gzip.length - 8),
      encoding: 'gzip',
      error: 'invalid compressed data',
    },
  ],
  [
    '/unsolicited-br',
    {
      body: 'not Brotli',
      encoding: 'br',
      error: 'unsupported compressed response',
    },
  ],
]);
const server = Deno.serve(
  { hostname: '127.0.0.1', port: 0, onListen() {} },
  (request) => {
    assert.equal(request.headers.get('accept-encoding'), 'identity');
    assert.equal(request.headers.get('connection'), 'keep-alive');
    const fixture = cases.get(new URL(request.url).pathname);
    const headers = { 'content-type': 'text/html' };
    if (fixture.encoding) headers['content-encoding'] = fixture.encoding;
    return new Response(fixture.body, { headers });
  },
);
try {
  // A successful request after each failed fixture verifies the process survives.
  for (const path of [...cases.keys()].flatMap((path) => [path, '/identity'])) {
    const client = new Client(`http://127.0.0.1:${server.addr.port}`, {
      pipelining: 1,
    });
    try {
      const deadline = AbortSignal.timeout(5_000);
      const raw = await client.request({
        path,
        method: 'GET',
        signal: deadline,
        maxRedirections: 0,
        headers: { 'accept-encoding': 'identity' },
      });
      const expectedError = cases.get(path).error;
      if (expectedError)
        await assert.rejects(
          readWebsiteResponse(raw, deadline),
          new RegExp(expectedError),
        );
      else
        assert.equal(
          await (await readWebsiteResponse(raw, deadline)).text(),
          html,
        );
      console.log(`PASS ${path}`);
    } finally {
      await client.destroy();
    }
  }
} finally {
  await server.shutdown();
}
