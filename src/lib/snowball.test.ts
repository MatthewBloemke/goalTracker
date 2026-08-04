import type { Loan } from '@/types'
import {
  applyPayment,
  buildSnowballSummary,
  calcMonthlyInterest,
  calcMonthsRemaining,
  calcTotalInterestRemaining,
  enrichLoan,
  formatCurrency,
  formatMonthsRemaining,
  formatRate,
  parseRate,
  sortLoans,
} from './snowball'

const NOW = new Date('2026-01-15T12:00:00.000Z')

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    created_at: '2026-01-01T00:00:00.000Z',
    current_balance: 1_000,
    family_id: null,
    id: 'loan-1',
    interest_rate: 0.12,
    is_active: true,
    lender: null,
    min_payment: 100,
    name: 'Test loan',
    original_amount: 2_000,
    paid_off_at: null,
    snowball_order: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    user_id: 'user-1',
    ...overrides,
  }
}

beforeAll(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
})

afterAll(() => {
  jest.useRealTimers()
})

describe('loan calculations', () => {
  test('calculates payoff months for standard and zero-interest loans', () => {
    expect(calcMonthsRemaining(1_000, 0, 300)).toBe(4)
    expect(calcMonthsRemaining(1_000, 0.12, 100)).toBe(11)
  })

  test('handles paid, non-paying, and interest-only loans', () => {
    expect(calcMonthsRemaining(0, 0.12, 100)).toBe(0)
    expect(calcMonthsRemaining(1_000, 0.12, 0)).toBe(Infinity)
    expect(calcMonthsRemaining(1_000, 0.12, 10)).toBe(Infinity)
  })

  test('calculates monthly and remaining interest', () => {
    expect(calcMonthlyInterest(1_000, 0.12)).toBe(10)
    expect(calcTotalInterestRemaining(1_000, 0.12, 100)).toBeCloseTo(58.98, 2)
    expect(calcTotalInterestRemaining(0, 0.12, 100)).toBe(0)
    expect(calcTotalInterestRemaining(1_000, 0, 100)).toBe(0)
  })

  test('enriches a loan with a bounded progress percentage and projection', () => {
    const projection = enrichLoan(makeLoan({ current_balance: 500 }), 50)

    expect(projection.months_remaining).toBe(4)
    expect([
      projection.payoff_date.getFullYear(),
      projection.payoff_date.getMonth(),
      projection.payoff_date.getDate(),
    ]).toEqual([2026, 4, 15])
    expect(projection.percent_paid).toBe(75)
    expect(projection.total_interest_remaining).toBeGreaterThan(0)

    expect(enrichLoan(makeLoan({ current_balance: 0 })).percent_paid).toBe(100)
    expect(enrichLoan(makeLoan({ original_amount: 0 })).percent_paid).toBe(0)
    expect(enrichLoan(makeLoan({ min_payment: 0 })).payoff_date.getFullYear()).toBe(9999)
  })
})

describe('snowball ordering and projection', () => {
  const small = makeLoan({ id: 'small', current_balance: 500, interest_rate: 0.05 })
  const expensive = makeLoan({ id: 'expensive', current_balance: 2_000, interest_rate: 0.2 })
  const paid = makeLoan({ id: 'paid', current_balance: 0, is_active: false })

  test('sorts by balance or interest without mutating the source list', () => {
    const source = [expensive, paid, small]

    expect(sortLoans(source, 'snowball').map((loan) => loan.id)).toEqual([
      'small', 'expensive', 'paid',
    ])
    expect(sortLoans(source, 'avalanche').map((loan) => loan.id)).toEqual([
      'expensive', 'small', 'paid',
    ])
    expect(source.map((loan) => loan.id)).toEqual(['expensive', 'paid', 'small'])
  })

  test('honors complete and partial manual ordering', () => {
    const first = makeLoan({ id: 'first', snowball_order: 1 })
    const second = makeLoan({ id: 'second', snowball_order: 2 })
    const automatic = makeLoan({ id: 'automatic' })

    expect(sortLoans([second, first], 'snowball').map((loan) => loan.id)).toEqual([
      'first', 'second',
    ])
    expect(sortLoans([automatic, first], 'snowball').map((loan) => loan.id)).toEqual([
      'first', 'automatic',
    ])
    expect(sortLoans([first, automatic], 'snowball').map((loan) => loan.id)).toEqual([
      'first', 'automatic',
    ])
  })

  test('builds totals, targets, payoff dates, and rolls freed payments forward', () => {
    const summary = buildSnowballSummary([
      makeLoan({ id: 'small', original_amount: 1_000, current_balance: 100, min_payment: 100, interest_rate: 0 }),
      makeLoan({ id: 'large', original_amount: 2_000, current_balance: 1_000, min_payment: 100, interest_rate: 0 }),
      makeLoan({ id: 'inactive', original_amount: 500, current_balance: 0, is_active: false }),
    ], 'snowball')

    expect(summary.total_original).toBe(3_500)
    expect(summary.total_current).toBe(1_100)
    expect(summary.total_paid).toBe(2_400)
    expect(summary.percent_complete).toBeCloseTo(68.57, 2)
    expect(summary.projected_total_interest).toBe(0)
    expect(summary.ordered_loans.map((loan) => loan.id)).toEqual(['small', 'large'])
    expect(summary.current_target?.id).toBe('small')
    expect(summary.next_target?.id).toBe('large')
    expect(summary.ordered_loans[0].months_remaining).toBe(1)
    expect(summary.ordered_loans[1].months_remaining).toBe(6)
    expect([
      summary.debt_free_date?.getFullYear(),
      summary.debt_free_date?.getMonth(),
      summary.debt_free_date?.getDate(),
    ]).toEqual([2026, 6, 15])
  })

  test('applies recurring and one-time extra payments to the target', () => {
    const loan = makeLoan({ current_balance: 1_000, min_payment: 100, interest_rate: 0 })

    expect(buildSnowballSummary([loan], 'snowball').ordered_loans[0].months_remaining).toBe(10)
    expect(buildSnowballSummary([loan], 'snowball', 100).ordered_loans[0].months_remaining).toBe(5)
    expect(buildSnowballSummary([loan], 'snowball', 0, 250).ordered_loans[0].months_remaining).toBe(8)
  })

  test('returns an empty summary when there are no active debts', () => {
    const summary = buildSnowballSummary([], 'snowball')

    expect(summary).toMatchObject({
      total_original: 0,
      total_current: 0,
      total_paid: 0,
      percent_complete: 0,
      projected_total_interest: 0,
      ordered_loans: [],
      current_target: null,
      next_target: null,
      debt_free_date: null,
    })
  })
})

describe('payments and display formatting', () => {
  test('splits a payment between interest and principal', () => {
    expect(applyPayment(makeLoan(), 100)).toEqual({
      balance_after: 910,
      principal_paid: 90,
      interest_paid: 10,
    })
  })

  test('does not report excess or negative principal', () => {
    expect(applyPayment(makeLoan(), 5)).toEqual({
      balance_after: 1_005,
      principal_paid: 0,
      interest_paid: 5,
    })
    expect(applyPayment(makeLoan(), 2_000)).toEqual({
      balance_after: 0,
      principal_paid: 1_000,
      interest_paid: 10,
    })
  })

  test('formats and parses rates, currency, and durations', () => {
    expect(formatRate(0.0525)).toBe('5.25%')
    expect(parseRate('5.25')).toBe(0.0525)
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
    expect(formatMonthsRemaining(Infinity)).toBe('Never (payment too low)')
    expect(formatMonthsRemaining(0)).toBe('Paid off!')
    expect(formatMonthsRemaining(5)).toBe('5mo')
    expect(formatMonthsRemaining(24)).toBe('2yr')
    expect(formatMonthsRemaining(29)).toBe('2yr 5mo')
  })
})
