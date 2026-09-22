import {
  buildReceiptOpenAiRequest,
  readOpenAiResponseStatus,
  readOpenAiTokenUsage,
  RECEIPT_MAX_OUTPUT_TOKENS,
  supportsReasoningEffortNone,
} from './openai-guardrails'

const buildRequest = (model: string) => buildReceiptOpenAiRequest({
  model,
  systemPrompt: 'Extract this receipt.',
  categories: [{ id: 'category-id', name: 'Groceries' }],
  image: { data: 'aGVsbG8=', mimeType: 'image/jpeg' },
  schema: { type: 'object' },
})

describe('receipt OpenAI request safeguards', () => {
  test('hard-caps output tokens and explicitly requests high image detail', () => {
    const request = buildRequest('gpt-4o-mini')
    const userContent = request.input[1].content

    expect(request.max_output_tokens).toBe(RECEIPT_MAX_OUTPUT_TOKENS)
    expect(request.max_output_tokens).toBe(2000)
    expect(userContent[1]).toMatchObject({ type: 'input_image', detail: 'high' })
  })

  test('uses no reasoning only for supported GPT-5 model families', () => {
    expect(buildRequest('gpt-5.1').reasoning).toEqual({ effort: 'none' })
    expect(buildRequest('gpt-5.4-mini').reasoning).toEqual({ effort: 'none' })
    expect(buildRequest('gpt-5.6-luna').reasoning).toEqual({ effort: 'none' })
    expect(buildRequest('gpt-4o-mini').reasoning).toBeUndefined()
    expect(buildRequest('gpt-5.5-pro').reasoning).toBeUndefined()
    expect(supportsReasoningEffortNone('gpt-5')).toBe(false)
  })
})

describe('receipt OpenAI response safeguards', () => {
  test('identifies output-token truncation before output is parsed', () => {
    expect(readOpenAiResponseStatus({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
    })).toEqual({
      status: 'incomplete',
      incompleteReason: 'max_output_tokens',
    })
  })

  test('reads token usage for monitoring and rejects malformed usage', () => {
    expect(readOpenAiTokenUsage({
      usage: { input_tokens: 1234, output_tokens: 456, total_tokens: 1690 },
    })).toEqual({ inputTokens: 1234, outputTokens: 456, totalTokens: 1690 })
    expect(readOpenAiTokenUsage({
      usage: { input_tokens: 1234, output_tokens: null, total_tokens: 1234 },
    })).toBeNull()
  })
})
