import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveOpenAiModel } from '../_shared/openai-model.ts'
import { getReceiptCategories } from '../_shared/receipt-categories.ts'
import {
  buildReceiptSchema,
  validateReceiptAnalysis,
} from './receipt-validation.ts'
import {
  buildReceiptOpenAiRequest,
  readOpenAiResponseStatus,
  readOpenAiTokenUsage,
  type ReceiptOpenAiSource,
} from './openai-guardrails.ts'
import {
  getReceiptCategoryDescription,
  RECEIPT_SYSTEM_PROMPT,
} from './receipt-prompt.ts'
import { parseReceiptAccessDecision } from './receipt-access.ts'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const MAX_TEXT_CHARACTERS = 100_000
const MAX_CATEGORIES = 200
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const DOCUMENT_EXTENSIONS = new Map([
  ['application/pdf', '.pdf'],
  ['message/rfc822', '.eml'],
])
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

    const { data: membership, error: membershipError } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (membershipError) {
      console.error('Receipt family membership check failed', {
        userId: user.id,
        code: membershipError.code,
      })
      throw new PublicError('Unable to verify your family. Please try again.', 503)
    }
    if (!membership) {
      throw new PublicError('Create or join a family before scanning receipts.', 403)
    }

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
    if (familyId !== membership.family_id) {
      throw new PublicError('This receipt does not belong to your active family.', 403)
    }
    const requestedCategoryIds = readCategoryIds(body.categoryIds)
    const receiptSource = readReceiptSource(body.receipt)

    const groupQuery = supabase
      .from('budget_groups')
      .select('id, name, user_id, family_id')
      .is('archived_at', null)

    const { data: groups, error: groupError } = await groupQuery.eq('family_id', familyId)
    if (groupError) throw new PublicError('Unable to verify this budget scope.', 403)

    const groupIds = (groups ?? []).map(({ id }) => id)
    if (groupIds.length === 0) {
      throw new PublicError('Create at least one budget group and category before scanning a receipt.', 400)
    }

    const { data: categories, error: categoryError } = await supabase
      .from('budget_categories')
      .select('id, name, group_id, loan_id, include_in_receipt_scans')
      .in('id', requestedCategoryIds)
      .in('group_id', groupIds)
      .is('archived_at', null)
    if (categoryError) throw new PublicError('Unable to verify the supplied categories.', 403)

    const categoryById = new Map((categories ?? []).map((category) => [category.id, category]))
    const verifiedCategories = requestedCategoryIds
      .map((id) => categoryById.get(id))
      .filter((category): category is {
        id: string
        name: string
        group_id: string
        loan_id: string | null
        include_in_receipt_scans: boolean
      } => Boolean(category))
    if (verifiedCategories.length !== requestedCategoryIds.length) {
      throw new PublicError('One or more categories are unavailable in this budget.', 403)
    }

    // Filter on the server as well: older clients can still supply loan IDs.
    const receiptCategories = getReceiptCategories(verifiedCategories)
    if (receiptCategories.length === 0) {
      throw new PublicError('Enable at least one spending category for receipt scans in Edit groups.', 400)
    }
    const receiptCategoryIds = receiptCategories.map(({ id }) => id)
    const groupById = new Map((groups ?? []).map((group) => [group.id, group]))
    const modelCategories = receiptCategories.map((category) => {
      const groupName = groupById.get(category.group_id)?.name ?? 'Uncategorized'
      return {
        id: category.id,
        name: category.name,
        groupName,
        description: getReceiptCategoryDescription(category.name, groupName),
      }
    })
    const model = resolveOpenAiModel((name) => Deno.env.get(name))

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
        source: receiptSource,
        schema: buildReceiptSchema(receiptCategoryIds),
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
          'Receipt analysis reached the output limit. Try again with a clearer image, smaller document, or less pasted text.',
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
      throw new PublicError('The receipt could not be read. Try a clearer image, PDF, exported email, or pasted order summary.', 422)
    }

    let modelResult: unknown
    try {
      modelResult = JSON.parse(outputText)
    } catch {
      throw new PublicError('The receipt result was invalid. Please try again.', 502)
    }

    const analysis = validateReceiptAnalysis(
      modelResult,
      new Set(receiptCategoryIds),
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
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new PublicError('A valid family is required.', 400)
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

function readReceiptSource(value: unknown): ReceiptOpenAiSource {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PublicError('A receipt image, document, or pasted text is required.', 400)
  }
  const source = value as Record<string, unknown>
  if (source.type === 'image') return readImage(source)
  if (source.type === 'document') return readDocument(source)
  if (source.type === 'text') return readReceiptText(source)
  throw new PublicError('Choose a supported receipt input.', 400)
}

function readImage(value: Record<string, unknown>): ReceiptOpenAiSource {
  const { data, mimeType } = value
  if (typeof mimeType !== 'string' || !ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new PublicError('Use a JPEG, PNG, or WebP receipt image.', 415)
  }
  if (!isValidBase64(data)) {
    throw new PublicError('The receipt image is invalid.', 400)
  }
  const estimatedBytes = estimateBase64Bytes(data)
  if (estimatedBytes <= 0 || estimatedBytes > MAX_IMAGE_BYTES) {
    throw new PublicError('The processed receipt image must be 5 MB or smaller.', 413)
  }
  return { type: 'image', data, mimeType }
}

function readDocument(value: Record<string, unknown>): ReceiptOpenAiSource {
  const { data, mimeType, fileName } = value
  if (typeof mimeType !== 'string' || !DOCUMENT_EXTENSIONS.has(mimeType)) {
    throw new PublicError('Use a PDF or exported email (.eml) receipt.', 415)
  }
  if (
    typeof fileName !== 'string'
    || fileName.length === 0
    || fileName.length > 200
    || /[\u0000-\u001f\u007f]/.test(fileName)
    || fileName.includes('/')
    || fileName.includes('\\')
    || !fileName.toLowerCase().endsWith(DOCUMENT_EXTENSIONS.get(mimeType) ?? '')
  ) {
    throw new PublicError('The receipt document name is invalid.', 400)
  }
  if (!isValidBase64(data)) {
    throw new PublicError('The receipt document is invalid.', 400)
  }
  const estimatedBytes = estimateBase64Bytes(data)
  if (estimatedBytes <= 0 || estimatedBytes > MAX_DOCUMENT_BYTES) {
    throw new PublicError('The receipt document must be 10 MB or smaller.', 413)
  }

  const prefix = decodeBase64Prefix(data, 16 * 1024)
  if (mimeType === 'application/pdf') {
    if (prefix.indexOf('%PDF-') < 0 || prefix.indexOf('%PDF-') > 1024) {
      throw new PublicError('The selected file is not a valid PDF.', 415)
    }
  } else if (!looksLikeEmail(prefix)) {
    throw new PublicError('The selected file is not a valid exported email.', 415)
  }

  return {
    type: 'document',
    data,
    mimeType: mimeType as 'application/pdf' | 'message/rfc822',
    fileName,
  }
}

function readReceiptText(value: Record<string, unknown>): ReceiptOpenAiSource {
  const text = typeof value.text === 'string' ? value.text.trim() : ''
  if (text.length < 20) {
    throw new PublicError('Paste more of the receipt or order details.', 400)
  }
  if (text.length > MAX_TEXT_CHARACTERS) {
    throw new PublicError('Pasted receipt text must be 100,000 characters or fewer.', 413)
  }
  if (text.includes('\u0000')) {
    throw new PublicError('The pasted receipt text contains invalid characters.', 400)
  }
  return { type: 'text', text }
}

function isValidBase64(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length % 4 === 0
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
}

function estimateBase64Bytes(data: string) {
  return Math.floor(data.length * 0.75)
    - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0)
}

function decodeBase64Prefix(data: string, maxBytes: number) {
  try {
    const encodedLength = Math.min(data.length, Math.ceil(maxBytes / 3) * 4)
    const alignedLength = encodedLength - (encodedLength % 4)
    return atob(data.slice(0, alignedLength))
  } catch {
    throw new PublicError('The receipt document is invalid.', 400)
  }
}

function looksLikeEmail(prefix: string) {
  if (prefix.includes('\u0000')) return false
  const headers = new Set(
    [...prefix.matchAll(/^(from|to|subject|date|mime-version|content-type|message-id|received|delivered-to|return-path):/gim)]
      .map((match) => match[1].toLowerCase()),
  )
  return headers.size >= 2
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
