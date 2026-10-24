import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Client, buildConnector } from 'npm:undici@6.29.1';
import {
  readWebsiteResponse,
  RecipeWebsiteError,
  RECIPE_PAGE_MAX_BYTES,
} from './website-response.ts';

const unsafeDestination = () =>
  new Error(
    'Use a public recipe website. Private or internal network addresses are not supported.',
  );

// Fail closed for non-public, special-use, transition and metadata addresses.
// DNS answers use the same checks as literal IPs in URLs.
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 &&
        (b === 168 ||
          (b === 0 && (c === 0 || c === 2)) ||
          (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) ||
      address === '168.63.129.16'
    );
  }
  if (isIP(address) !== 6) return false;
  // URL canonicalization expands embedded IPv4 to hex and validates IPv6.
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [left, right = ''] = normalized.split('::');
  const leading = left ? left.split(':') : [];
  const trailing = right ? right.split(':') : [];
  const words = [
    ...leading,
    ...Array(8 - leading.length - trailing.length).fill('0'),
    ...trailing,
  ].map((word) => parseInt(word, 16));
  // Only globally routable unicast (2000::/3), excluding special ranges.
  return (
    (words[0] & 0xe000) === 0x2000 &&
    !(words[0] === 0x2001 && (words[1] < 0x200 || words[1] === 0xdb8)) &&
    words[0] !== 0x2002 &&
    !(words[0] === 0x3fff && words[1] < 0x1000)
  );
}

export function validateImportUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a valid recipe website URL.');
  }
  if (
    raw.length > 2048 ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error(
      'Use an HTTP or HTTPS recipe webpage on its standard port, without login credentials in the URL.',
    );
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const address = host.replace(/^\[|\]$/g, '');
  if (isIP(address)) {
    if (!isPublicAddress(address)) throw unsafeDestination();
  } else if (
    host.length > 253 ||
    !host.includes('.') ||
    host
      .split('.')
      .some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    /(?:^|\.)(?:localhost|local|internal|home\.arpa)$/.test(host)
  ) {
    throw unsafeDestination();
  }
  url.hostname = host;
  url.hash = '';
  return url;
}

// DNS lookup itself must not let an import outlive the shared fetch deadline.
async function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  let onAbort: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort!);
  }
}

export type RecipePage = {
  response: Pick<Response, 'body' | 'headers' | 'status' | 'ok'>;
  close: () => Promise<void>;
};
export type RecipePageFetcher = (
  url: URL,
  signal: AbortSignal,
) => Promise<RecipePage>;

// A checked DNS lookup followed by ordinary fetch() is not enough: fetch may
// resolve again to a private IP (DNS rebinding). Pin the actual socket to a
// checked address, retaining the original Host header and TLS server name.
// Never fall back to an unpinned fetch if this transport fails.
export const fetchPublicRecipePage: RecipePageFetcher = async (
  input,
  signal,
) => {
  const url = validateImportUrl(input.href);
  signal.throwIfAborted();
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: { address: string; family: number }[];
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await withAbort(
          lookup(hostname, { all: true, verbatim: true }),
          signal,
        );
  } catch {
    signal.throwIfAborted();
    throw new Error(
      'This website could not be reached. Check the link or paste its recipe text instead.',
    );
  }
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  )
    throw unsafeDestination();
  const address = (
    addresses.find((entry) => entry.family === 4) ?? addresses[0]
  ).address;
  const connector = buildConnector({
    rejectUnauthorized: true,
    timeout: 12_000,
    maxCachedSessions: 0,
  });
  const client = new Client(url.origin, {
    connect: (options, callback) =>
      connector(
        {
          ...options,
          hostname: address,
          servername: isIP(hostname) ? undefined : hostname,
        },
        callback,
      ),
    maxResponseSize: RECIPE_PAGE_MAX_BYTES,
    maxHeaderSize: 16_384,
    headersTimeout: 12_000,
    bodyTimeout: 12_000,
    // One in-flight request, with keep-alive until its body is consumed. Using
    // 0 sends Connection: close; some servers then close TLS without an alert,
    // which Deno 2.1.4 can report before delivering the final response bytes.
    // The client is still destroyed immediately after this one page is read.
    pipelining: 1,
  });
  try {
    const raw = await client.request({
      path: url.pathname + url.search,
      method: 'GET',
      maxRedirections: 0,
      signal,
      headers: {
        Accept: 'text/html',
        'Accept-Encoding': 'identity',
        // Raw requests do not supply fetch's default User-Agent. Some recipe
        // sites close the connection entirely if this header is missing.
        'User-Agent': 'FamilyPortalRecipeImporter/1.0',
      },
    });
    const response = await readWebsiteResponse(raw, signal);
    return {
      response,
      close: () => client.destroy(),
    };
  } catch (error) {
    await client.destroy();
    signal.throwIfAborted();
    if (error instanceof RecipeWebsiteError) throw error;
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'UND_ERR_RES_EXCEEDED_MAX_SIZE'
    ) {
      throw new RecipeWebsiteError(
        'Source is too large. Paste just the recipe text instead.',
      );
    }
    throw new Error(
      'This website could not be read. Paste its recipe text instead.',
    );
  }
};
