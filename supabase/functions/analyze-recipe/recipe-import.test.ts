/** @jest-environment node */
import {
  buildRecipeRequest,
  extractRecipeText,
  fetchRecipeText,
  parseRecipeResponse,
  readBoundedText,
  validateImportUrl,
} from './recipe-import';

const recipe = {
  title: 'Soup',
  servings: null,
  sourceUrl: '',
  notes: '',
  tags: ['soup'],
  ingredients: [
    {
      name: 'salt',
      quantity: 1,
      unit: 'tsp',
      preparation: '',
      shoppingQuantity: 1,
      shoppingUnit: 'container',
    },
  ],
  instructions: ['Stir.'],
};
const response = (data: unknown) => ({
  status: 'completed',
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify(data) }],
    },
  ],
});

describe('recipe source security', () => {
  test.each([
    'http://allrecipes.com/a',
    'https://localhost/a',
    'https://127.0.0.1/a',
    'https://2130706433/a',
    'https://[::1]/a',
    'https://allrecipes.com.evil.com/a',
    'https://user:password@allrecipes.com',
    'https://allrecipes.com:8080/a',
    'https://unapproved.example/a',
    'garbage',
  ])('rejects non-allowlisted/unsafe destinations: %s', (url) => {
    expect(() => validateImportUrl(url)).toThrow();
  });
  test('handles Facebook explicitly without fetching video', () => {
    expect(() =>
      validateImportUrl('https://www.facebook.com/reel/123'),
    ).toThrow('caption or transcript');
    expect(() => validateImportUrl('https://fb.watch/123')).toThrow(
      'caption or transcript',
    );
  });
  test('allows exact trusted sites and configured hosts only', () => {
    expect(
      validateImportUrl('https://www.allrecipes.com/recipe/123#recipe').href,
    ).toBe('https://www.allrecipes.com/recipe/123');
    expect(
      validateImportUrl('https://custom.example/recipe', ['custom.example'])
        .hostname,
    ).toBe('custom.example');
  });
  test('revalidates redirects before any follow-up request', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: 'http://169.254.169.254/metadata' },
        }),
      );
    await expect(
      fetchRecipeText('https://allrecipes.com/test', undefined, fetcher),
    ).rejects.toThrow('not enabled');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  test('follows safe relative redirects and extracts final page', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: '/actual' } }),
      )
      .mockResolvedValueOnce(
        new Response('<p>Ingredients: salt. Stir.</p>', {
          headers: { 'content-type': 'text/html' },
        }),
      );
    await expect(
      fetchRecipeText('https://allrecipes.com/test', undefined, fetcher),
    ).resolves.toBe('Ingredients: salt. Stir.');
    expect(fetcher.mock.calls[1][0].href).toBe('https://allrecipes.com/actual');
  });
  test('bounds redirects and rejects inaccessible/binary sources', async () => {
    const redirect = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(null, { status: 302, headers: { location: '/again' } }),
        ),
      );
    await expect(
      fetchRecipeText('https://allrecipes.com/test', undefined, redirect),
    ).rejects.toThrow('too many');
    for (const result of [
      new Response('blocked', { status: 403 }),
      new Response('video', { headers: { 'content-type': 'video/mp4' } }),
    ]) {
      await expect(
        fetchRecipeText(
          'https://allrecipes.com/test',
          undefined,
          jest.fn().mockResolvedValue(result),
        ),
      ).rejects.toThrow();
    }
  });
  test('bounds streamed bytes even without Content-Length', async () => {
    await expect(readBoundedText(new Response('12345'), 4)).rejects.toThrow(
      'too large',
    );
    await expect(
      readBoundedText(
        new Response('x', { headers: { 'content-length': '500' } }),
        4,
      ),
    ).rejects.toThrow('too large');
    await expect(readBoundedText(new Response(null), 4)).rejects.toThrow(
      'empty',
    );
    await expect(readBoundedText(new Response('é'), 2)).resolves.toBe('é');
  });
});

describe('extraction and AI guardrails', () => {
  test('prefers Recipe JSON-LD and discards unrelated page content', () => {
    const html = `<nav>Ignore this</nav><script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'Article' }, { '@type': ['Recipe'], name: 'Soup', recipeIngredient: ['1 tsp salt'], recipeInstructions: 'Stir.', image: 'huge-unneeded-image' }] })}</script>`;
    expect(JSON.parse(extractRecipeText(html))).toEqual({
      name: 'Soup',
      recipeIngredient: ['1 tsp salt'],
      recipeInstructions: 'Stir.',
    });
    expect(
      extractRecipeText(
        '<script type="application/ld+json">bad json</script><p>Salt &amp; pepper</p><style>junk</style>',
      ),
    ).toBe('Salt & pepper');
  });
  test('does not silently truncate overlong sources', () => {
    expect(() => extractRecipeText(`<p>${'a'.repeat(16001)}</p>`)).toThrow(
      'isolate',
    );
    expect(() => extractRecipeText('<script>nothing</script>')).toThrow();
    expect(() =>
      extractRecipeText(
        `<script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'x'.repeat(16001) })}</script>`,
      ),
    ).toThrow('too long');
  });
  test('uses strict schema, a hard output cap, no storage, bounded text and no tools', () => {
    const request = buildRecipeRequest('gpt-4o-mini', '1 tsp salt. Stir.');
    expect(request).toMatchObject({
      model: 'gpt-4o-mini',
      store: false,
      max_output_tokens: 2000,
      text: { format: { strict: true, type: 'json_schema' } },
    });
    expect(request).not.toHaveProperty('tools');
    expect(request).not.toHaveProperty('reasoning');
    expect(buildRecipeRequest('gpt-5.4', 'Soup').reasoning).toEqual({
      effort: 'none',
    });
    expect(() =>
      buildRecipeRequest('gpt-4o-mini', 'x'.repeat(16001)),
    ).toThrow();
    expect(() => buildRecipeRequest('gpt-4o-mini', ' ')).toThrow();
    expect(request.input[0].content).toContain('UNTRUSTED');
  });
  test('validates output, retains authoritative source URL and returns only a draft', () => {
    expect(
      parseRecipeResponse(
        response({ recipe, warnings: [] }),
        'https://example.com',
      ),
    ).toEqual({
      recipe: { ...recipe, sourceUrl: 'https://example.com/' },
      warnings: [],
    });
  });
  test.each([
    null,
    {
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      ...{ output: response({ recipe, warnings: [] }).output },
    },
    { status: 'completed', output: [] },
    response({ recipe: null, warnings: [] }),
    response({ recipe: { ...recipe, ingredients: [] }, warnings: [] }),
    response({ recipe, warnings: [42] }),
    { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] },
  ])('rejects incomplete, refused or malformed output %#', (value) => {
    expect(() => parseRecipeResponse(value, '')).toThrow();
  });
});
