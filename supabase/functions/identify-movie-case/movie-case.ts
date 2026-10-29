export const MOVIE_CASE_MAX_OUTPUT_TOKENS = 400

export const MOVIE_CASE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'releaseYear', 'confidence', 'requiresReview', 'alternatives'],
  properties: {
    title: { type: ['string', 'null'] },
    releaseYear: { type: ['integer', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    requiresReview: { type: 'boolean' },
    alternatives: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'releaseYear'],
        properties: {
          title: { type: 'string' },
          releaseYear: { type: ['integer', 'null'] },
        },
      },
    },
  },
}

export interface MovieCaseIdentification {
  title: string | null
  releaseYear: number | null
  confidence: number
  requiresReview: boolean
  alternatives: Array<{ title: string; releaseYear: number | null }>
}

export function buildMovieCaseRequest(
  model: string,
  image: { data: string; mimeType: string },
) {
  const request = {
    model,
    store: false,
    max_output_tokens: MOVIE_CASE_MAX_OUTPUT_TOKENS,
    input: [
      {
        role: 'system',
        content: [{
          type: 'input_text',
          text: 'You identify commercially released movies from photos of physical cases. Read the front cover and spine carefully. Return the printed movie title. Include a release year only when visible or reliably implied by a distinctive edition; otherwise use null. Do not guess when the image could match multiple movies. Return only the structured result.',
        }],
      },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Identify the movie on this case so it can be searched in TMDB.' },
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
        name: 'movie_case_identification',
        strict: true,
        schema: MOVIE_CASE_SCHEMA,
      },
    },
  }
  return supportsReasoningEffortNone(model)
    ? { ...request, reasoning: { effort: 'none' } }
    : request
}

export function validateMovieCaseIdentification(value: unknown): MovieCaseIdentification {
  if (!isRecord(value)) throw new Error('Invalid movie identification')
  const title = value.title === null ? null : cleanTitle(value.title)
  const releaseYear = nullableYear(value.releaseYear)
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)
      || value.confidence < 0 || value.confidence > 1
      || typeof value.requiresReview !== 'boolean'
      || !Array.isArray(value.alternatives)
      || value.alternatives.length > 2) {
    throw new Error('Invalid movie identification')
  }
  const alternatives = value.alternatives.map((item) => {
    if (!isRecord(item)) throw new Error('Invalid movie identification')
    return { title: cleanTitle(item.title), releaseYear: nullableYear(item.releaseYear) }
  })
  return {
    title,
    releaseYear,
    confidence: value.confidence,
    requiresReview: value.requiresReview || !title || value.confidence < 0.7,
    alternatives,
  }
}

function supportsReasoningEffortNone(model: string) {
  const version = /^gpt-5\.(\d+)(?:$|-)/i.exec(model)
  return Boolean(version && Number(version[1]) >= 1 && Number(version[1]) <= 6
    && !/(?:^|-)pro(?:-|$)/i.test(model))
}

function cleanTitle(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 300) {
    throw new Error('Invalid movie identification')
  }
  return value.trim()
}

function nullableYear(value: unknown) {
  if (value === null) return null
  if (!Number.isInteger(value) || Number(value) < 1870 || Number(value) > 2100) {
    throw new Error('Invalid movie identification')
  }
  return Number(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
