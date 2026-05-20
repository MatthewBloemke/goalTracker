import dayjs from 'dayjs'
import type { Loan, LoanWithProjection, SnowballSummary, SnowballStrategy } from '@/types'

/**
 * Calculate how many months to pay off a loan given:
 * - current balance
 * - monthly interest rate
 * - fixed monthly payment
 *
 * Uses the standard amortization formula:
 * n = -log(1 - (r * P) / M) / log(1 + r)
 * where P = principal, r = monthly rate, M = monthly payment
 */
export function calcMonthsRemaining(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): number {
  if (balance <= 0) return 0
  if (annualRate === 0) {
    // No interest — simple division
    return Math.ceil(balance / monthlyPayment)
  }

  const r = annualRate / 12
  const numerator = Math.log(1 - (r * balance) / monthlyPayment)
  const denominator = Math.log(1 + r)

  if (numerator >= 0 || isNaN(numerator)) {
    // Payment doesn't cover interest — infinite or invalid
    return Infinity
  }

  return Math.ceil(-numerator / denominator)
}

/**
 * Calculate the interest portion of the next payment
 */
export function calcMonthlyInterest(balance: number, annualRate: number): number {
  return balance * (annualRate / 12)
}

/**
 * Calculate total interest remaining over the life of the loan
 */
export function calcTotalInterestRemaining(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): number {
  if (balance <= 0 || annualRate === 0) return 0

  let remaining = balance
  let totalInterest = 0
  const monthlyRate = annualRate / 12
  let months = 0
  const maxMonths = 1200 // 100 year safety cap

  while (remaining > 0 && months < maxMonths) {
    const interest = remaining * monthlyRate
    totalInterest += interest
    const principal = Math.min(monthlyPayment - interest, remaining)
    remaining -= principal
    months++
  }

  return totalInterest
}

/**
 * Enrich a loan with computed projection data
 */
export function enrichLoan(loan: Loan, extraMonthlyPayment = 0): LoanWithProjection {
  const effectivePayment = loan.min_payment + extraMonthlyPayment
  const months = calcMonthsRemaining(loan.current_balance, loan.interest_rate, effectivePayment)
  const payoff_date = months === Infinity
    ? new Date(9999, 0, 1)
    : dayjs().add(months, 'month').toDate()

  const total_interest = calcTotalInterestRemaining(
    loan.current_balance,
    loan.interest_rate,
    effectivePayment
  )

  const percent_paid = loan.original_amount > 0
    ? Math.min(100, ((loan.original_amount - loan.current_balance) / loan.original_amount) * 100)
    : 0

  return {
    ...loan,
    months_remaining: months,
    payoff_date,
    total_interest_remaining: total_interest,
    percent_paid,
  }
}

/**
 * Sort loans by snowball strategy:
 * - 'snowball': lowest balance first (psychological wins)
 * - 'avalanche': highest interest rate first (mathematically optimal)
 *
 * Paid-off loans always sort to the end.
 * Manual snowball_order overrides strategy sort when set.
 */
export function sortLoans(loans: Loan[], strategy: SnowballStrategy): Loan[] {
  return [...loans].sort((a, b) => {
    // Paid off loans sink to the bottom
    if (!a.is_active && b.is_active) return 1
    if (a.is_active && !b.is_active) return -1

    // Manual order takes precedence
    if (a.snowball_order !== null && b.snowball_order !== null) {
      return a.snowball_order - b.snowball_order
    }
    if (a.snowball_order !== null) return -1
    if (b.snowball_order !== null) return 1

    // Strategy sort
    if (strategy === 'snowball') {
      return a.current_balance - b.current_balance
    } else {
      return b.interest_rate - a.interest_rate
    }
  })
}

/**
 * Build a full snowball summary from a list of loans
 */
export function buildSnowballSummary(
  loans: Loan[],
  strategy: SnowballStrategy,
  extraMonthlyBudget = 0
): SnowballSummary {
  const activeLoans = loans.filter(l => l.is_active && l.current_balance > 0)
  const sorted = sortLoans(activeLoans, strategy)

  // In true snowball, the extra budget always goes to the first target.
  // Once paid off, that loan's min payment rolls into the next one.
  const enriched = sorted.map((loan, index) =>
    enrichLoan(loan, index === 0 ? extraMonthlyBudget : 0)
  )

  const total_original = loans.reduce((sum, l) => sum + l.original_amount, 0)
  const total_current = loans.reduce((sum, l) => sum + l.current_balance, 0)
  const total_paid = total_original - total_current

  const percent_complete = total_original > 0
    ? Math.min(100, (total_paid / total_original) * 100)
    : 0

  // Estimate overall debt-free date from last loan's payoff date
  const debt_free_date = enriched.length > 0
    ? enriched[enriched.length - 1].payoff_date
    : null

  return {
    total_original,
    total_current,
    total_paid,
    percent_complete,
    debt_free_date,
    ordered_loans: enriched,
    current_target: enriched[0] ?? null,
    next_target: enriched[1] ?? null,
  }
}

/**
 * Simulate applying a payment to a loan.
 * Returns the new balance after the payment is applied.
 */
export function applyPayment(
  loan: Loan,
  paymentAmount: number
): { balance_after: number; principal_paid: number; interest_paid: number } {
  const interest_paid = calcMonthlyInterest(loan.current_balance, loan.interest_rate)
  const principal_paid = Math.min(paymentAmount - interest_paid, loan.current_balance)
  const balance_after = Math.max(0, loan.current_balance - principal_paid)

  return {
    balance_after,
    principal_paid: Math.max(0, principal_paid),
    interest_paid,
  }
}

/**
 * Format interest rate from decimal to display string
 * 0.0525 → "5.25%"
 */
export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`
}

/**
 * Parse interest rate from user input string to decimal
 * "5.25" → 0.0525
 */
export function parseRate(input: string): number {
  return parseFloat(input) / 100
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format months remaining into a human-readable string
 */
export function formatMonthsRemaining(months: number): string {
  if (months === Infinity) return 'Never (payment too low)'
  if (months <= 0) return 'Paid off!'
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (years === 0) return `${remainingMonths}mo`
  if (remainingMonths === 0) return `${years}yr`
  return `${years}yr ${remainingMonths}mo`
}
