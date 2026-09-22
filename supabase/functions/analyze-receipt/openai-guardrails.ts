export const RECEIPT_MAX_OUTPUT_TOKENS = 2000

interface BuildReceiptOpenAiRequestOptions {
  model: string
  systemPrompt: string
  categories: unknown[]
  image: {
    data: string
    mimeType: string
  }
  schema: unknown
}

export interface OpenAiTokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export function buildReceiptOpenAiRequest({
  model,
  systemPrompt,
  categories,
  image,
  schema,
}: BuildReceiptOpenAiRequestOptions) {
  const request = {
    model,
    store: false,
    max_output_tokens: RECEIPT_MAX_OUTPUT_TOKENS,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Classify this receipt using only these categories:\n${JSON.stringify(categories)}`,
          },
          {
            type: 'input_image',
            image_url: `data:${image.mimeType};base64,${image.data}`,
            detail: 'high',
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'receipt_analysis',
        strict: true,
        schema,
      },
    },
  }

  return supportsReasoningEffortNone(model)
    ? { ...request, reasoning: { effort: 'none' } }
    : request
}

export function supportsReasoningEffortNone(model: string) {
  if (/(?:^|-)pro(?:-|$)/i.test(model)) return false

  const version = /^gpt-5\.(\d+)(?:$|-)/i.exec(model)
  if (!version) return false

  const minorVersion = Number(version[1])
  return minorVersion >= 1 && minorVersion <= 6
}

export function readOpenAiResponseStatus(payload: unknown) {
  if (!isRecord(payload)) return { status: null, incompleteReason: null }

  const status = typeof payload.status === 'string' ? payload.status : null
  const incompleteDetails = isRecord(payload.incomplete_details)
    ? payload.incomplete_details
    : null
  const incompleteReason = typeof incompleteDetails?.reason === 'string'
    ? incompleteDetails.reason
    : null

  return { status, incompleteReason }
}

export function readOpenAiTokenUsage(payload: unknown): OpenAiTokenUsage | null {
  if (!isRecord(payload) || !isRecord(payload.usage)) return null

  const inputTokens = readTokenCount(payload.usage.input_tokens)
  const outputTokens = readTokenCount(payload.usage.output_tokens)
  const totalTokens = readTokenCount(payload.usage.total_tokens)
  if (inputTokens === null || outputTokens === null || totalTokens === null) return null

  return { inputTokens, outputTokens, totalTokens }
}

function readTokenCount(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
