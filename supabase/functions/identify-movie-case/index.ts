import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveOpenAiModel } from '../_shared/openai-model.ts'
import {
  buildMovieCaseRequest,
  validateMovieCaseIdentification,
} from './movie-case.ts'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) throw new PublicError('Authentication is required.', 401)
    const supabase = createClient(
      requiredEnvironmentValue('SUPABASE_URL'),
      getSupabasePublicKey(),
      { global: { headers: { Authorization: authorization } } },
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new PublicError('Authentication is required.', 401)

    const { data: membership, error: membershipError } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (membershipError) throw new PublicError('Unable to verify your family.', 503)
    if (!membership) throw new PublicError('Create a family before scanning movie cases.', 403)

    const { data: grant, error: grantError } = await supabase
      .from('feature_access_grants')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('feature', 'movie_case_analysis')
      .is('revoked_at', null)
      .maybeSingle()
    if (grantError) throw new PublicError('Unable to verify case-scanning access.', 503)
    if (!grant) throw new PublicError('Movie case scanning is not enabled for this account.', 403)

    const body = await readBody(request)
    const image = readImage(body.image)
    const { data: access, error: accessError } = await supabase
      .rpc('consume_movie_case_analysis_quota')
    if (accessError || !isRecord(access) || typeof access.allowed !== 'boolean') {
      throw new PublicError('Unable to verify case-scanning access.', 503)
    }
    if (!access.allowed) {
      if (access.reason === 'not_approved') {
        throw new PublicError('Movie case scanning is not enabled for this account.', 403)
      }
      throw new PublicError('Movie case scanning limit reached. Please try again later.', 429)
    }

    const model = resolveOpenAiModel((name) => Deno.env.get(name))
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requiredEnvironmentValue('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildMovieCaseRequest(model, image)),
    })
    const payload = await response.json()
    logUsage(payload, response.headers.get('x-request-id'), model)
    if (!response.ok) {
      console.error('OpenAI movie case analysis failed', { status: response.status })
      throw new PublicError('Movie case analysis is temporarily unavailable.', 502)
    }
    if (isRecord(payload) && payload.status === 'incomplete') {
      throw new PublicError('Movie case analysis was incomplete. Try a clearer photo.', 422)
    }
    const output = extractOutputText(payload)
    if (!output) throw new PublicError('The movie title could not be read. Try a clearer photo.', 422)
    let parsed: unknown
    try { parsed = JSON.parse(output) } catch { throw new PublicError('The movie result was invalid.', 502) }
    try {
      return json(validateMovieCaseIdentification(parsed))
    } catch {
      throw new PublicError('The movie result was invalid.', 502)
    }
  } catch (error) {
    if (!(error instanceof PublicError)) console.error('Movie case analysis failed', error)
    return json(
      { error: error instanceof PublicError ? error.message : 'Movie case analysis failed.' },
      error instanceof PublicError ? error.status : 500,
    )
  }
})

function readBody(request: Request): Promise<Record<string, unknown>> {
  return request.json().then((value) => {
    if (!isRecord(value)) throw new PublicError('Invalid request body.', 400)
    return value
  }).catch((error) => {
    if (error instanceof PublicError) throw error
    throw new PublicError('Invalid request body.', 400)
  })
}

function readImage(value: unknown) {
  if (!isRecord(value)) throw new PublicError('A movie case image is required.', 400)
  const { data, mimeType } = value
  if (typeof mimeType !== 'string' || !ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new PublicError('Use a JPEG, PNG, or WebP image.', 415)
  }
  if (typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new PublicError('The movie case image is invalid.', 400)
  }
  const bytes = Math.floor(data.length * 0.75) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0)
  if (bytes <= 0 || bytes > MAX_IMAGE_BYTES) {
    throw new PublicError('The processed movie case image must be 5 MB or smaller.', 413)
  }
  return { data, mimeType }
}

function extractOutputText(payload: unknown) {
  if (!isRecord(payload)) return null
  if (typeof payload.output_text === 'string') return payload.output_text
  if (!Array.isArray(payload.output)) return null
  for (const output of payload.output) {
    if (!isRecord(output) || !Array.isArray(output.content)) continue
    for (const item of output.content) {
      if (isRecord(item) && item.type === 'output_text' && typeof item.text === 'string') return item.text
    }
  }
  return null
}

function logUsage(payload: unknown, requestId: string | null, model: string) {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    console.warn('OpenAI movie case token usage unavailable', { requestId, model })
    return
  }
  console.info('OpenAI movie case token usage', {
    requestId,
    model: typeof payload.model === 'string' ? payload.model : model,
    inputTokens: payload.usage.input_tokens,
    outputTokens: payload.usage.output_tokens,
    totalTokens: payload.usage.total_tokens,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getSupabasePublicKey() {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacyKey) return legacyKey
  const keys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch { /* Safe configuration error below. */ }
  }
  throw new Error('Missing Supabase publishable key')
}

function requiredEnvironmentValue(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

class PublicError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}
