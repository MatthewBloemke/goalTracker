/** @jest-environment node */
import { lookup } from 'node:dns/promises';
import {
  Client,
  buildConnector,
  fetch as publicFetch,
} from 'npm:undici@6.29.1';
import {
  fetchPublicRecipePage,
  isPublicAddress,
  validateImportUrl,
} from './public-web';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('npm:undici@6.29.1', () => ({
  Client: jest.fn(),
  buildConnector: jest.fn(),
  fetch: jest.fn(),
}));

const dns = lookup as jest.Mock;
const fetcher = publicFetch as jest.Mock;
const createClient = Client as unknown as jest.Mock;
const build = buildConnector as jest.Mock;
const close = jest.fn();
const connector = jest.fn();
const signal = () => AbortSignal.timeout(12_000);

beforeEach(() => {
  jest.resetAllMocks();
  dns.mockResolvedValue([{ address: '93.184.215.14', family: 4 }]);
  close.mockResolvedValue(undefined);
  createClient.mockImplementation(() => ({ destroy: close }));
  build.mockReturnValue(connector);
  fetcher.mockResolvedValue(
    new Response('<p>Soup</p>', { headers: { 'content-type': 'text/html' } }),
  );
});

test.each([
  '0.0.0.0',
  '10.0.0.1',
  '127.0.0.1',
  '100.64.0.1',
  '100.127.255.255',
  '169.254.169.254',
  '172.16.0.1',
  '172.31.255.255',
  '192.168.1.1',
  '192.0.0.1',
  '192.0.2.1',
  '192.88.99.1',
  '198.18.0.1',
  '198.19.0.1',
  '198.51.100.1',
  '203.0.113.1',
  '224.0.0.1',
  '255.255.255.255',
  '168.63.129.16',
  '::',
  '::1',
  '::ffff:127.0.0.1',
  '::ffff:8.8.8.8',
  'fc00::1',
  'fd00::1',
  'fe80::1',
  'ff02::1',
  '64:ff9b::7f00:1',
  '2001:db8::1',
  '2001::1',
  '2002:7f00:1::',
  '3fff::1',
  'invalid',
  '999.1.2.3',
])('rejects non-public address %s', (address) => {
  expect(isPublicAddress(address)).toBe(false);
});

test.each([
  '1.1.1.1',
  '8.8.8.8',
  '93.184.215.14',
  '100.128.0.1',
  '172.32.0.1',
  '192.169.1.1',
  '2606:4700:4700::1111',
  '2001:4860:4860::8888',
  '2606:2800:220:1:248:1893:25c8:1946',
])('accepts public address %s', (address) => {
  expect(isPublicAddress(address)).toBe(true);
});

test.each([
  'http://0x7f000001/',
  'http://0177.0.0.1/',
  'http://2130706433/',
  'http://127.1/',
  'https://[::ffff:127.0.0.1]/',
  'https://localhost./',
  'https://foo.localhost/',
  'https://foo.internal/',
  'https://home.arpa/',
  'https://foo.home.arpa/',
  'https://foo_bar.example/',
  'https://-foo.example/',
  `https://${'a'.repeat(64)}.com/`,
  'ftp://public.example/',
  'https://user:pass@public.example/',
  'https://public.example:8443/',
  `https://public.example/${'x'.repeat(2048)}`,
])('rejects unsafe or malformed URL %s', (url) => {
  expect(() => validateImportUrl(url)).toThrow();
});

test('normalizes names and accepts international domains and public IP literals', () => {
  expect(validateImportUrl('https://RECIPES.EXAMPLE./soup#recipe').href).toBe(
    'https://recipes.example/soup',
  );
  expect(validateImportUrl('https://recettes.café/').hostname).toBe(
    'recettes.xn--caf-dma',
  );
  expect(validateImportUrl('http://1.1.1.1/').hostname).toBe('1.1.1.1');
  expect(validateImportUrl('https://[2606:4700:4700::1111]/').hostname).toBe(
    '[2606:4700:4700::1111]',
  );
});

test.each(
  [
    [],
    [{ address: '127.0.0.1', family: 4 }],
    [
      { address: '93.184.215.14', family: 4 },
      { address: 'fd00::1', family: 6 },
    ],
    [{ address: 'not-an-ip', family: 4 }],
  ].map((answers) => [answers]),
)(
  'rejects empty, internal, or mixed DNS answers before connecting: %j',
  async (answers) => {
    dns.mockResolvedValue(answers);
    await expect(
      fetchPublicRecipePage(new URL('https://recipes.example/'), signal()),
    ).rejects.toThrow('public recipe website');
    expect(createClient).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  },
);

test('pins every connection to the checked IP, retaining the hostname and TLS validation', async () => {
  const deadline = signal();
  dns
    .mockResolvedValueOnce([
      { address: '2606:4700:4700::1111', family: 6 },
      { address: '93.184.215.14', family: 4 },
    ])
    .mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
  const result = await fetchPublicRecipePage(
    new URL('https://recipes.example/soup'),
    deadline,
  );
  const [origin, options] = createClient.mock.calls[0];
  expect(origin).toBe('https://recipes.example');
  expect(build).toHaveBeenCalledWith(
    expect.objectContaining({ rejectUnauthorized: true }),
  );
  const callback = jest.fn();
  for (let attempt = 0; attempt < 2; attempt++)
    options.connect(
      {
        hostname: 'recipes.example',
        host: 'recipes.example',
        protocol: 'https:',
        port: '443',
      },
      callback,
    );
  expect(connector).toHaveBeenCalledWith(
    expect.objectContaining({
      hostname: '93.184.215.14',
      servername: 'recipes.example',
      host: 'recipes.example',
    }),
    callback,
  );
  expect(dns).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    'https://recipes.example/soup',
    expect.objectContaining({
      redirect: 'manual',
      credentials: 'omit',
      signal: deadline,
      headers: { Accept: 'text/html' },
    }),
  );
  expect(result.response.status).toBe(200);
  await result.close();
  expect(close).toHaveBeenCalledTimes(1);
});

test('supports IPv6-only public DNS and avoids DNS for public literal addresses', async () => {
  dns.mockResolvedValue([{ address: '2606:4700:4700::1111', family: 6 }]);
  const result = await fetchPublicRecipePage(
    new URL('http://recipes.example/'),
    signal(),
  );
  createClient.mock.calls[0][1].connect({}, jest.fn());
  expect(connector.mock.calls[0][0].hostname).toBe('2606:4700:4700::1111');
  await result.close();
  dns.mockClear();
  const literal = await fetchPublicRecipePage(
    new URL('http://1.1.1.1/'),
    signal(),
  );
  createClient.mock.calls[1][1].connect({}, jest.fn());
  expect(connector.mock.calls[1][0]).toMatchObject({
    hostname: '1.1.1.1',
    servername: undefined,
  });
  expect(dns).not.toHaveBeenCalled();
  await literal.close();
});

test('sanitizes DNS/transport errors and closes failed connections', async () => {
  dns.mockRejectedValueOnce(new Error('internal DNS details'));
  await expect(
    fetchPublicRecipePage(new URL('https://recipes.example/'), signal()),
  ).rejects.toThrow('could not be reached');
  fetcher.mockRejectedValueOnce(new Error('private connection details'));
  await expect(
    fetchPublicRecipePage(new URL('https://recipes.example/'), signal()),
  ).rejects.toThrow('could not be read');
  expect(close).toHaveBeenCalledTimes(1);
});

test('checks the shared deadline during DNS and before connecting', async () => {
  const abort = new AbortController();
  dns.mockReturnValue(new Promise(() => {}));
  const result = fetchPublicRecipePage(
    new URL('https://recipes.example/'),
    abort.signal,
  );
  abort.abort(new DOMException('Deadline exceeded', 'TimeoutError'));
  await expect(result).rejects.toThrow('Deadline exceeded');
  expect(fetcher).not.toHaveBeenCalled();
  await expect(
    fetchPublicRecipePage(new URL('https://recipes.example/'), abort.signal),
  ).rejects.toThrow('Deadline exceeded');
});

test('preserves deadline errors and closes transport after an aborted fetch', async () => {
  const abort = new AbortController();
  fetcher.mockImplementationOnce(() => {
    abort.abort(new DOMException('Deadline exceeded', 'TimeoutError'));
    return Promise.reject(new Error('aborted'));
  });
  await expect(
    fetchPublicRecipePage(new URL('https://recipes.example/'), abort.signal),
  ).rejects.toThrow('Deadline exceeded');
  expect(close).toHaveBeenCalledTimes(1);
});

test('re-resolves each redirect destination and blocks a rebinding hostname', async () => {
  const { fetchRecipeText } = await import('./recipe-import');
  dns
    .mockResolvedValueOnce([{ address: '93.184.215.14', family: 4 }])
    .mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }]);
  fetcher.mockResolvedValueOnce(
    new Response(null, {
      status: 302,
      headers: { location: 'https://recipes.example/next' },
    }),
  );
  await expect(fetchRecipeText('https://recipes.example/soup')).rejects.toThrow(
    'public recipe website',
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});
