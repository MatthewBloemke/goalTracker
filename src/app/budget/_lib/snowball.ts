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
  if (monthlyPayment <= 0) return Infinity
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
  extraMonthlyBudget = 0,
  currentMonthExtraPayment = 0
): SnowballSummary {
  const activeLoans = loans.filter(l => l.is_active && l.current_balance > 0)
  const sorted = sortLoans(activeLoans, strategy)

  const projections = projectSnowball(
    sorted,
    extraMonthlyBudget,
    currentMonthExtraPayment
  )
  const projectionById = new Map(
    projections.map((projection) => [projection.id, projection])
  )

  const enriched = sorted.map((loan) => {
    const projection = projectionById.get(loan.id)
    const percent_paid = loan.original_amount > 0
      ? Math.min(100, ((loan.original_amount - loan.current_balance) / loan.original_amount) * 100)
      : 0

    return {
      ...loan,
      months_remaining: projection?.months_remaining ?? 0,
      payoff_date: projection?.payoff_date ?? new Date(),
      total_interest_remaining: projection?.total_interest_remaining ?? 0,
      percent_paid,
    }
  })

  const total_original = loans.reduce((sum, l) => sum + l.original_amount, 0)
  const total_current = loans.reduce((sum, l) => sum + l.current_balance, 0)
  const total_paid = total_original - total_current
  const projected_total_interest = projections.reduce(
    (sum, projection) => sum + projection.total_interest_remaining,
    0
  )

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
    projected_total_interest,
    ordered_loans: enriched,
    current_target: enriched[0] ?? null,
    next_target: enriched[1] ?? null,
  }
}

interface LoanProjection {
  id: string
  months_remaining: number
  payoff_date: Date
  total_interest_remaining: number
}

interface SimulatedLoan {
  id: string
  balance: number
  minPayment: number
  monthlyRate: number
  totalInterest: number
  paidOffMonth: number | null
}

function projectSnowball(
  sortedLoans: Loan[],
  extraMonthlyBudget: number,
  currentMonthExtraPayment: number
): LoanProjection[] {
  const simulations: SimulatedLoan[] = sortedLoans.map((loan) => ({
    id: loan.id,
    balance: Math.max(0, loan.current_balance),
    minPayment: Math.max(0, loan.min_payment),
    monthlyRate: Math.max(0, loan.interest_rate) / 12,
    totalInterest: 0,
    paidOffMonth: loan.current_balance <= 0 ? 0 : null,
  }))

  const monthlyBudget = simulations.reduce((sum, loan) => sum + loan.minPayment, 0)
    + Math.max(0, extraMonthlyBudget)
  const oneTimeExtra = Math.max(0, currentMonthExtraPayment)
  const maxMonths = 1200

  for (let month = 1; month <= maxMonths; month++) {
    const activeIndexes = getActiveIndexes(simulations)
    if (activeIndexes.length === 0) break

    for (const index of activeIndexes) {
      const loan = simulations[index]
      const interest = loan.balance * loan.monthlyRate
      loan.balance += interest
      loan.totalInterest += interest
    }

    let remainingPayment = monthlyBudget

    for (const index of activeIndexes.slice(1)) {
      const payment = Math.min(simulations[index].minPayment, remainingPayment)
      remainingPayment -= payment
      payDown(simulations, index, payment, month)
    }

    const targetIndex = getFirstActiveIndex(simulations)
    if (targetIndex !== null) {
      payDown(simulations, targetIndex, remainingPayment, month)
    }

    if (month === 1 && oneTimeExtra > 0) {
      applyPrincipalOnlyPayment(simulations, oneTimeExtra, month)
    }
  }

  return simulations.map((loan) => ({
    id: loan.id,
    months_remaining: loan.paidOffMonth ?? Infinity,
    payoff_date: loan.paidOffMonth === null
      ? new Date(9999, 0, 1)
      : dayjs().add(loan.paidOffMonth, 'month').toDate(),
    total_interest_remaining: loan.totalInterest,
  }))
}

function getActiveIndexes(loans: SimulatedLoan[]) {
  return loans.reduce<number[]>((indexes, loan, index) => {
    if (loan.balance > 0.005) indexes.push(index)
    return indexes
  }, [])
}

function getFirstActiveIndex(loans: SimulatedLoan[]) {
  const index = loans.findIndex((loan) => loan.balance > 0.005)
  return index === -1 ? null : index
}

function payDown(
  loans: SimulatedLoan[],
  startIndex: number,
  amount: number,
  paidOffMonth: number
) {
  let remaining = Math.max(0, amount)

  for (let index = startIndex; index < loans.length && remaining > 0; index++) {
    const loan = loans[index]
    if (loan.balance <= 0.005) continue

    const payment = Math.min(loan.balance, remaining)
    loan.balance -= payment
    remaining -= payment

    if (loan.balance <= 0.005) {
      loan.balance = 0
      loan.paidOffMonth ??= paidOffMonth
    }
  }
}

function applyPrincipalOnlyPayment(
  loans: SimulatedLoan[],
  amount: number,
  paidOffMonth: number
) {
  const targetIndex = getFirstActiveIndex(loans)
  if (targetIndex === null) return
  payDown(loans, targetIndex, amount, paidOffMonth)
}

/**
 * Simulate applying a payment to a loan.
 * Returns the new balance after the payment is applied.
 */
export function applyPayment(
  loan: Loan,
  paymentAmount: number
): { balance_after: number; principal_paid: number; interest_paid: number } {
  const interest_due = calcMonthlyInterest(loan.current_balance, loan.interest_rate)
  const interest_paid = Math.min(paymentAmount, interest_due)
  const principal_paid = Math.min(
    Math.max(0, paymentAmount - interest_due),
    loan.current_balance
  )
  const balance_after = Math.max(
    0,
    loan.current_balance + interest_due - paymentAmount
  )

  return {
    balance_after,
    principal_paid,
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
