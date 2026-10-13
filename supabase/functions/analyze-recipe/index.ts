import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  isRecord,
  RECIPE_TEXT_MAX_LENGTH,
  safeSourceUrl,
} from '../_shared/recipe.ts';
import { readOpenAiTokenUsage } from '../analyze-receipt/openai-guardrails.ts';
import {
  buildRecipeRequest,
  DEFAULT_RECIPE_HOSTS,
  fetchRecipeText,
  parseRecipeResponse,
  readBoundedText,
} from './recipe-import.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: cors });
  if (request.method !== 'POST')
    return json({ error: 'Method not allowed.' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer '))
    return json({ error: 'Sign in to import recipes.' }, 401);
  try {
    const publicKey =
      Deno.env.get('SUPABASE_ANON_KEY') ??
      JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publicKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return json({ error: 'Your session expired. Sign in again.' }, 401);
    const { data: grant, error: grantError } = await supabase
      .from('feature_access_grants')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('feature', 'recipe_import')
      .is('revoked_at', null)
      .maybeSingle();
    if (grantError)
      return json({ error: 'Unable to verify recipe import access.' }, 503);
    if (!grant)
      return json(
        {
          error:
            'AI recipe import requires administrator approval. You can still add recipes manually or import a recipe file.',
        },
        403,
      );
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey)
      return json({ error: 'AI recipe import is not configured yet.' }, 503);

    let sourceUrl: string;
    let sourceText: string;
    try {
      const input: unknown = JSON.parse(await readBoundedText(request, 80_000));
      if (
        !isRecord(input) ||
        typeof input.text !== 'string' ||
        input.text.length > RECIPE_TEXT_MAX_LENGTH
      )
        throw new Error('Recipe text must be at most 16,000 characters.');
      sourceUrl = safeSourceUrl(input.sourceUrl);
      sourceText = input.text.trim();
      if (!sourceText && !sourceUrl)
        throw new Error('Enter a website link or paste recipe text.');
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error ? error.message : 'Invalid import request.',
        },
        400,
      );
    }

    // Reserve before fetching too: an approved user cannot use this as an
    // unlimited proxy. Failed attempts conservatively consume one quota slot.
    const { data: quota, error: quotaError } = await supabase.rpc(
      'consume_recipe_import_quota',
    );
    if (quotaError || !isRecord(quota))
      return json({ error: 'Unable to check recipe import limits.' }, 503);
    if (quota.allowed !== true)
      return json(
        {
          error:
            quota.reason === 'not_approved'
              ? 'Recipe import access was revoked.'
              : 'Recipe import limit reached. Try again later or add the recipe manually.',
        },
        quota.reason === 'not_approved' ? 403 : 429,
      );
    if (!sourceText) {
      const extraHosts = (Deno.env.get('RECIPE_IMPORT_ALLOWED_HOSTS') ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean);
      try {
        sourceText = await fetchRecipeText(sourceUrl, [
          ...DEFAULT_RECIPE_HOSTS,
          ...extraHosts,
        ]);
      } catch (error) {
        return json(
          {
            error:
              error instanceof Error && error.name !== 'TimeoutError'
                ? error.message
                : 'Website took too long to respond. Paste recipe text instead.',
          },
          422,
        );
      }
    }
    const model = Deno.env.get('OPENAI_RECIPE_MODEL') || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildRecipeRequest(model, sourceText)),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return json(
        {
          error:
            'AI recipe import is temporarily unavailable. Please retry later.',
        },
        502,
      );
    }
    const payload: unknown = await response.json();
    console.info('recipe_import_usage', {
      requestId: quota.requestId,
      model,
      usage: readOpenAiTokenUsage(payload),
    });
    try {
      return json(parseRecipeResponse(payload, sourceUrl));
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Unable to read the extracted recipe.',
        },
        422,
      );
    }
  } catch {
    // Never log source content, credentials or raw upstream errors.
    return json(
      {
        error:
          'Recipe import failed or timed out. Nothing was saved. Please try again.',
      },
      503,
    );
  }
});
