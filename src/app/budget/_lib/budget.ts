import dayjs from 'dayjs'
import type {
  BudgetCategory,
  BudgetGroup,
  BudgetTransaction,
  BudgetTransactionSplit,
  MonthlyBudget,
  MonthlyBudgetAllocation,
} from '@/types'

export interface CategoryBudgetSnapshot {
  category: BudgetCategory
  planned: number
  rollover: number
  available: number
  spent: number
  remaining: number
  paidThisMonth: boolean
}

export interface GroupBudgetSnapshot {
  group: BudgetGroup
  categories: CategoryBudgetSnapshot[]
  planned: number
  rollover: number
  available: number
  spent: number
  remaining: number
}

export interface MonthlyBudgetSummary {
  income: number
  assigned: number
  rollover: number
  available: number
  spent: number
  unassigned: number
  status: 'balanced' | 'under-planned' | 'over-planned'
  groups: GroupBudgetSnapshot[]
}

export function toBudgetMonth(date: Date | string): string {
  return dayjs(date).startOf('month').format('YYYY-MM-DD')
}

export function shiftBudgetMonth(month: string, offset: number): string {
  return dayjs(month).add(offset, 'month').startOf('month').format('YYYY-MM-DD')
}

export function getBudgetMonthRange(month: string) {
  return {
    start: toBudgetMonth(month),
    end: shiftBudgetMonth(month, 1),
  }
}

export function calculateMonthlyBudget(
  budget: MonthlyBudget | null,
  groups: BudgetGroup[],
  categories: BudgetCategory[],
  allocations: MonthlyBudgetAllocation[],
  transactions: BudgetTransaction[],
  splits: BudgetTransactionSplit[],
): MonthlyBudgetSummary {
  const allocationByCategory = new Map(
    allocations.map((allocation) => [allocation.category_id, allocation]),
  )
  const visibleTransactionIds = new Set(transactions.map(({ id }) => id))
  const spentByCategory = new Map<string, number>()

  for (const split of splits) {
    if (!visibleTransactionIds.has(split.transaction_id)) continue
    spentByCategory.set(
      split.category_id,
      roundMoney((spentByCategory.get(split.category_id) ?? 0) + split.amount),
    )
  }

  const categoriesByGroup = new Map<string, BudgetCategory[]>()
  for (const category of categories) {
    const current = categoriesByGroup.get(category.group_id) ?? []
    current.push(category)
    categoriesByGroup.set(category.group_id, current)
  }

  const groupSnapshots = groups.map((group) => {
    const categorySnapshots = (categoriesByGroup.get(group.id) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((category): CategoryBudgetSnapshot => {
        const allocation = allocationByCategory.get(category.id)
        const planned = allocation?.planned_amount ?? 0
        const rollover = allocation?.rollover_amount ?? 0
        const available = roundMoney(planned + rollover)
        const spent = spentByCategory.get(category.id) ?? 0

        return {
          category,
          planned,
          rollover,
          available,
          spent,
          remaining: roundMoney(available - spent),
          paidThisMonth: category.loan_id !== null && spent > 0,
        }
      })

    return {
      group,
      categories: categorySnapshots,
      planned: sum(categorySnapshots.map(({ planned }) => planned)),
      rollover: sum(categorySnapshots.map(({ rollover }) => rollover)),
      available: sum(categorySnapshots.map(({ available }) => available)),
      spent: sum(categorySnapshots.map(({ spent }) => spent)),
      remaining: sum(categorySnapshots.map(({ remaining }) => remaining)),
    }
  })

  const income = budget?.income ?? 0
  const assigned = sum(groupSnapshots.map(({ planned }) => planned))
  const rollover = sum(groupSnapshots.map((group) => group.rollover))
  const unassigned = roundMoney(income - assigned)

  return {
    income,
    assigned,
    rollover,
    available: roundMoney(assigned + rollover),
    spent: sum(groupSnapshots.map(({ spent }) => spent)),
    unassigned,
    status: unassigned === 0
      ? 'balanced'
      : unassigned > 0
        ? 'under-planned'
        : 'over-planned',
    groups: groupSnapshots,
  }
}

export function validateTransactionSplits(
  amount: number,
  splits: Array<{ categoryId: string; amount: number }>,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than zero.'
  if (splits.length === 0) return 'Choose at least one category.'
  if (splits.some((split) => !split.categoryId || !Number.isFinite(split.amount) || split.amount <= 0)) {
    return 'Every category split needs a positive amount.'
  }
  if (new Set(splits.map(({ categoryId }) => categoryId)).size !== splits.length) {
    return 'Each category can only be used once.'
  }
  if (roundMoney(sum(splits.map((split) => split.amount))) !== roundMoney(amount)) {
    return 'Category splits must add up to the transaction total.'
  }
  return null
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function sum(values: number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0))
}
