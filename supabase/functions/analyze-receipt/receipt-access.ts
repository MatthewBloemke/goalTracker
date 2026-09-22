export interface AllowedReceiptAccess {
  allowed: true
  requestId: string
  remainingHour: number
  remainingDay: number
}

export interface DeniedReceiptAccess {
  allowed: false
  reason: 'unauthenticated' | 'not_approved' | 'hourly_limit' | 'daily_limit'
  retryAfterSeconds: number | null
}

export type ReceiptAccessDecision = AllowedReceiptAccess | DeniedReceiptAccess

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DENIAL_REASONS = new Set([
  'unauthenticated',
  'not_approved',
  'hourly_limit',
  'daily_limit',
])

export function parseReceiptAccessDecision(value: unknown): ReceiptAccessDecision | null {
  if (!isRecord(value) || typeof value.allowed !== 'boolean') return null

  if (value.allowed) {
    if (
      typeof value.requestId !== 'string'
      || !UUID_PATTERN.test(value.requestId)
      || !isNonNegativeInteger(value.remainingHour)
      || !isNonNegativeInteger(value.remainingDay)
    ) {
      return null
    }
    return {
      allowed: true,
      requestId: value.requestId,
      remainingHour: value.remainingHour,
      remainingDay: value.remainingDay,
    }
  }

  if (typeof value.reason !== 'string' || !DENIAL_REASONS.has(value.reason)) return null
  const retryAfterSeconds = isPositiveInteger(value.retryAfterSeconds)
    ? value.retryAfterSeconds
    : null
  return {
    allowed: false,
    reason: value.reason as DeniedReceiptAccess['reason'],
    retryAfterSeconds,
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
