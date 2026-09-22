import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  buildReceiptSchema,
  validateReceiptAnalysis,
} from './receipt-validation.ts'
import {
  buildReceiptOpenAiRequest,
  readOpenAiResponseStatus,
  readOpenAiTokenUsage,
} from './openai-guardrails.ts'
import {
  getReceiptCategoryDescription,
  RECEIPT_SYSTEM_PROMPT,
} from './receipt-prompt.ts'
import { parseReceiptAccessDecision } from './receipt-access.ts'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_CATEGORIES = 200
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: 'Authentication is required.' }, 401)
    }

    const supabase = createClient(
      requiredEnvironmentValue('SUPABASE_URL'),
      getSupabasePublicKey(),
      { global: { headers: { Authorization: authorization } } },
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return json({ error: 'Authentication is required.' }, 401)

    const { data: accessGrant, error: grantError } = await supabase
      .from('feature_access_grants')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('feature', 'receipt_analysis')
      .is('revoked_at', null)
      .maybeSingle()
    if (grantError) {
      console.error('Receipt analysis grant check failed', {
        userId: user.id,
        code: grantError.code,
      })
      throw new PublicError('Unable to verify receipt-scanning access. Please try again.', 503)
    }
    if (!accessGrant) {
      console.warn('Receipt analysis request denied', {
        userId: user.id,
        reason: 'not_approved',
      })
      throw new PublicError('Receipt scanning is not enabled for this account.', 403)
    }

    const body = await readRequestBody(request)
    const familyId = readFamilyId(body.familyId)
    const requestedCategoryIds = readCategoryIds(body.categoryIds)
    const image = readImage(body.image)

    let groupQuery = supabase
      .from('budget_groups')
      .select('id, name, user_id, family_id')
      .is('archived_at', null)
    groupQuery = familyId
      ? groupQuery.eq('family_id', familyId)
      : groupQuery.is('family_id', null).eq('user_id', user.id)

    const { data: groups, error: groupError } = await groupQuery
    if (groupError) throw new PublicError('Unable to verify this budget scope.', 403)

    const groupIds = (groups ?? []).map(({ id }) => id)
    if (groupIds.length === 0) {
      throw new PublicError('Create at least one budget group and category before scanning a receipt.', 400)
    }

    const { data: categories, error: categoryError } = await supabase
      .from('budget_categories')
      .select('id, name, group_id')
      .in('id', requestedCategoryIds)
      .in('group_id', groupIds)
      .is('archived_at', null)
    if (categoryError) throw new PublicError('Unable to verify the supplied categories.', 403)

    const categoryById = new Map((categories ?? []).map((category) => [category.id, category]))
    const verifiedCategories = requestedCategoryIds
      .map((id) => categoryById.get(id))
      .filter((category): category is { id: string; name: string; group_id: string } => Boolean(category))
    if (verifiedCategories.length !== requestedCategoryIds.length) {
      throw new PublicError('One or more categories are unavailable in this budget.', 403)
    }

    const groupById = new Map((groups ?? []).map((group) => [group.id, group]))
    const modelCategories = verifiedCategories.map((category) => {
      const groupName = groupById.get(category.group_id)?.name ?? 'Uncategorized'
      return {
        id: category.id,
        name: category.name,
        groupName,
        description: getReceiptCategoryDescription(category.name, groupName),
      }
    })
    const model = Deno.env.get('OPENAI_RECEIPT_MODEL') || DEFAULT_MODEL

    const { data: rawAccessDecision, error: accessError } = await supabase
      .rpc('consume_receipt_analysis_quota')
    if (accessError) {
      console.error('Receipt analysis access check failed', {
        userId: user.id,
        code: accessError.code,
      })
      throw new PublicError('Unable to verify receipt-scanning access. Please try again.', 503)
    }

    const accessDecision = parseReceiptAccessDecision(rawAccessDecision)
    if (!accessDecision) {
      console.error('Receipt analysis access check returned an invalid decision', {
        userId: user.id,
      })
      throw new PublicError('Unable to verify receipt-scanning access. Please try again.', 503)
    }
    if (!accessDecision.allowed) {
      console.warn('Receipt analysis request denied', {
        userId: user.id,
        reason: accessDecision.reason,
      })
      if (accessDecision.reason === 'not_approved') {
        throw new PublicError('Receipt scanning is not enabled for this account.', 403)
      }
      if (accessDecision.reason === 'unauthenticated') {
        throw new PublicError('Authentication is required.', 401)
      }
      throw new PublicError(
        'Receipt scanning limit reached. Please try again later.',
        429,
        accessDecision.retryAfterSeconds
          ? { 'Retry-After': String(accessDecision.retryAfterSeconds) }
          : undefined,
      )
    }

    console.info('Receipt analysis request authorized', {
      userId: user.id,
      requestId: accessDecision.requestId,
      remainingHour: accessDecision.remainingHour,
      remainingDay: accessDecision.remainingDay,
    })

    const openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requiredEnvironmentValue('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildReceiptOpenAiRequest({
        model,
        systemPrompt: RECEIPT_SYSTEM_PROMPT,
        categories: modelCategories,
        image,
        schema: buildReceiptSchema(requestedCategoryIds),
      })),
    })

    const openAiPayload = await openAiResponse.json()
    logOpenAiUsage(
      openAiPayload,
      openAiResponse.headers.get('x-request-id'),
      model,
    )
    if (!openAiResponse.ok) {
      console.error('OpenAI receipt analysis failed', {
        status: openAiResponse.status,
        requestId: openAiResponse.headers.get('x-request-id'),
      })
      throw new PublicError('Receipt analysis is temporarily unavailable. Please try again.', 502)
    }

    const { status: responseStatus, incompleteReason } = readOpenAiResponseStatus(openAiPayload)
    if (responseStatus === 'incomplete') {
      if (incompleteReason === 'max_output_tokens') {
        throw new PublicError(
          'Receipt analysis reached the output limit. Try again with a clearer or more tightly cropped photo.',
          422,
        )
      }
      throw new PublicError('Receipt analysis was incomplete. Please try again.', 502)
    }
    if (responseStatus && responseStatus !== 'completed') {
      throw new PublicError('Receipt analysis did not complete. Please try again.', 502)
    }

    const outputText = extractOutputText(openAiPayload)
    if (!outputText) {
      throw new PublicError('The receipt could not be read. Try a clearer, well-lit photo.', 422)
    }

    let modelResult: unknown
    try {
      modelResult = JSON.parse(outputText)
    } catch {
      throw new PublicError('The receipt result was invalid. Please try again.', 502)
    }

    const analysis = validateReceiptAnalysis(
      modelResult,
      new Set(requestedCategoryIds),
    )
    return json(analysis)
  } catch (error) {
    const status = error instanceof PublicError ? error.status : 500
    const message = error instanceof PublicError
      ? error.message
      : 'Receipt analysis failed. Please try again.'
    if (!(error instanceof PublicError)) console.error('Receipt analysis error', error)
    return json(
      { error: message },
      status,
      error instanceof PublicError ? error.responseHeaders : undefined,
    )
  }
})

function readRequestBody(request: Request): Promise<Record<string, unknown>> {
  return request.json().then((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new PublicError('Invalid request body.', 400)
    }
    return value as Record<string, unknown>
  }).catch((error) => {
    if (error instanceof PublicError) throw error
    throw new PublicError('Invalid request body.', 400)
  })
}

function readFamilyId(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new PublicError('Invalid family scope.', 400)
  }
  return value
}

function readCategoryIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CATEGORIES) {
    throw new PublicError('Supply between 1 and 200 budget categories.', 400)
  }
  const ids = [...new Set(value)]
  if (ids.length !== value.length || ids.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))) {
    throw new PublicError('Invalid budget category IDs.', 400)
  }
  return ids as string[]
}

function readImage(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PublicError('A receipt image is required.', 400)
  }
  const { data, mimeType } = value as Record<string, unknown>
  if (typeof mimeType !== 'string' || !ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new PublicError('Use a JPEG, PNG, or WebP receipt image.', 415)
  }
  if (typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new PublicError('The receipt image is invalid.', 400)
  }
  const estimatedBytes = Math.floor(data.length * 0.75) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0)
  if (estimatedBytes <= 0 || estimatedBytes > MAX_IMAGE_BYTES) {
    throw new PublicError('The processed receipt image must be 5 MB or smaller.', 413)
  }
  return { data, mimeType }
}

function extractOutputText(payload: unknown) {
  if (typeof payload !== 'object' || payload === null) return null
  const response = payload as Record<string, unknown>
  if (typeof response.output_text === 'string') return response.output_text
  if (!Array.isArray(response.output)) return null

  for (const output of response.output) {
    if (typeof output !== 'object' || output === null) continue
    const content = (output as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const item of content) {
      if (typeof item !== 'object' || item === null) continue
      const candidate = item as Record<string, unknown>
      if (candidate.type === 'output_text' && typeof candidate.text === 'string') {
        return candidate.text
      }
    }
  }
  return null
}

function logOpenAiUsage(payload: unknown, requestId: string | null, requestedModel: string) {
  const usage = readOpenAiTokenUsage(payload)
  const responseModel = typeof payload === 'object'
      && payload !== null
      && 'model' in payload
      && typeof payload.model === 'string'
    ? payload.model
    : requestedModel

  if (!usage) {
    console.warn('OpenAI receipt token usage unavailable', { requestId, model: responseModel })
    return
  }

  console.info('OpenAI receipt token usage', {
    requestId,
    model: responseModel,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  })
}

function getSupabasePublicKey() {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacyKey) return legacyKey

  const publishableKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (publishableKeys) {
    try {
      const keys = JSON.parse(publishableKeys) as Record<string, string>
      if (keys.default) return keys.default
    } catch {
      // The error below gives a safe configuration message without logging secrets.
    }
  }
  throw new Error('Missing Supabase publishable key')
}

function requiredEnvironmentValue(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function json(
  body: unknown,
  status = 200,
  responseHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...responseHeaders,
      'Content-Type': 'application/json',
    },
  })
}

class PublicError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseHeaders: Record<string, string> = {},
  ) {
    super(message)
  }
}
