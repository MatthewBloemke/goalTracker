import type {
  BudgetCategory,
  BudgetGroup,
  BudgetTransaction,
  BudgetTransactionSplit,
  MonthlyBudget,
  MonthlyBudgetAllocation,
} from '@/types'
import {
  calculateMonthlyBudget,
  getBudgetMonthRange,
  roundMoney,
  shiftBudgetMonth,
  toBudgetMonth,
  validateTransactionSplits,
} from './budget'

const group = (overrides: Partial<BudgetGroup> = {}): BudgetGroup => ({
  id: 'group-food', user_id: 'user-1', family_id: null, name: 'Food', sort_order: 0,
  is_system: false, archived_at: null, created_at: '2026-08-01', updated_at: '2026-08-01', ...overrides,
})
const category = (overrides: Partial<BudgetCategory> = {}): BudgetCategory => ({
  id: 'category-grocery', group_id: 'group-food', loan_id: null, name: 'Groceries', sort_order: 0,
  is_system: false, archived_at: null, created_at: '2026-08-01', updated_at: '2026-08-01', ...overrides,
})
const budget = (overrides: Partial<MonthlyBudget> = {}): MonthlyBudget => ({
  id: 'budget-1', user_id: 'user-1', family_id: null, month: '2026-08-01', income: 1_000,
  created_by: 'user-1', created_at: '2026-08-01', updated_at: '2026-08-01', ...overrides,
})
const allocation = (overrides: Partial<MonthlyBudgetAllocation> = {}): MonthlyBudgetAllocation => ({
  id: 'allocation-1', monthly_budget_id: 'budget-1', category_id: 'category-grocery',
  planned_amount: 500, rollover_amount: 50, created_at: '2026-08-01', updated_at: '2026-08-01', ...overrides,
})
const transaction = (overrides: Partial<BudgetTransaction> = {}): BudgetTransaction => ({
  id: 'transaction-1', user_id: 'user-1', family_id: null, created_by: 'user-1', amount: 450,
  occurred_on: '2026-08-10', merchant: 'Market', note: null, source: 'manual', payment_id: null,
  receipt_storage_path: null, created_at: '2026-08-10', updated_at: '2026-08-10', ...overrides,
})
const split = (overrides: Partial<BudgetTransactionSplit> = {}): BudgetTransactionSplit => ({
  id: 'split-1', transaction_id: 'transaction-1', category_id: 'category-grocery', amount: 450,
  created_at: '2026-08-10', ...overrides,
})

describe('budget month helpers', () => {
  test('normalizes, shifts, and builds half-open month ranges', () => {
    expect(toBudgetMonth('2026-08-19')).toBe('2026-08-01')
    expect(shiftBudgetMonth('2026-08-01', 1)).toBe('2026-09-01')
    expect(shiftBudgetMonth('2026-01-01', -1)).toBe('2025-12-01')
    expect(getBudgetMonthRange('2026-08-19')).toEqual({ start: '2026-08-01', end: '2026-09-01' })
  })
})

describe('monthly budget calculations', () => {
  test('separates current income assignments from rollover surplus', () => {
    const result = calculateMonthlyBudget(
      budget(), [group()], [category()], [allocation()], [transaction()], [split()],
    )

    expect(result).toMatchObject({
      income: 1_000,
      assigned: 500,
      rollover: 50,
      available: 550,
      spent: 450,
      unassigned: 500,
      status: 'under-planned',
    })
    expect(result.groups[0].categories[0]).toMatchObject({
      planned: 500,
      rollover: 50,
      available: 550,
      spent: 450,
      remaining: 100,
    })
  })

  test('reports balanced and over-planned months', () => {
    expect(calculateMonthlyBudget(budget({ income: 500 }), [group()], [category()], [allocation({ rollover_amount: 0 })], [], []).status).toBe('balanced')
    const over = calculateMonthlyBudget(budget({ income: 400 }), [group()], [category()], [allocation({ rollover_amount: 0 })], [], [])
    expect(over.status).toBe('over-planned')
    expect(over.unassigned).toBe(-100)
  })

  test('marks debt categories paid and ignores splits outside the visible month transaction set', () => {
    const debt = category({ loan_id: 'loan-1' })
    const result = calculateMonthlyBudget(
      budget(), [group()], [debt], [allocation()], [transaction()], [
        split(),
        split({ id: 'other-split', transaction_id: 'other-transaction', amount: 99 }),
      ],
    )
    expect(result.groups[0].categories[0].paidThisMonth).toBe(true)
  })

  test('returns a zeroed empty summary', () => {
    expect(calculateMonthlyBudget(null, [], [], [], [], [])).toMatchObject({
      income: 0, assigned: 0, rollover: 0, available: 0, spent: 0, unassigned: 0, status: 'balanced', groups: [],
    })
  })
})

describe('transaction split validation', () => {
  test('accepts exact multi-category splits', () => {
    expect(validateTransactionSplits(25, [
      { categoryId: 'food', amount: 20 },
      { categoryId: 'home', amount: 5 },
    ])).toBeNull()
  })

  test('rejects invalid totals, duplicates, missing categories, and non-positive amounts', () => {
    expect(validateTransactionSplits(0, [])).toMatch(/greater than zero/)
    expect(validateTransactionSplits(10, [])).toMatch(/at least one/)
    expect(validateTransactionSplits(10, [{ categoryId: '', amount: 10 }])).toMatch(/positive amount/)
    expect(validateTransactionSplits(10, [{ categoryId: 'food', amount: -1 }])).toMatch(/positive amount/)
    expect(validateTransactionSplits(10, [{ categoryId: 'food', amount: 5 }, { categoryId: 'food', amount: 5 }])).toMatch(/only be used once/)
    expect(validateTransactionSplits(10, [{ categoryId: 'food', amount: 9 }])).toMatch(/add up/)
  })

  test('rounds currency safely', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  })
})
