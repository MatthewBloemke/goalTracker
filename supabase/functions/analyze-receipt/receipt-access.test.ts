import { parseReceiptAccessDecision } from './receipt-access'

const requestId = '11111111-1111-4111-8111-111111111111'

describe('receipt access decisions', () => {
  test('accepts a valid quota reservation', () => {
    expect(parseReceiptAccessDecision({
      allowed: true,
      requestId,
      remainingHour: 8,
      remainingDay: 28,
    })).toEqual({
      allowed: true,
      requestId,
      remainingHour: 8,
      remainingDay: 28,
    })
  })

  test.each([
    ['not_approved', null],
    ['hourly_limit', 125],
    ['daily_limit', 3600],
    ['unauthenticated', null],
  ])('accepts a valid %s denial', (reason, retryAfterSeconds) => {
    expect(parseReceiptAccessDecision({
      allowed: false,
      reason,
      retryAfterSeconds,
    })).toEqual({ allowed: false, reason, retryAfterSeconds })
  })

  test.each([
    null,
    {},
    { allowed: true, requestId: 'invalid', remainingHour: 1, remainingDay: 1 },
    { allowed: true, requestId, remainingHour: -1, remainingDay: 1 },
    { allowed: false, reason: 'invented' },
  ])('fails closed for a malformed decision', (value) => {
    expect(parseReceiptAccessDecision(value)).toBeNull()
  })
})
