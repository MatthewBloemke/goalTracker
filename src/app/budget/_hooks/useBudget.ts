'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import {
  calculateMonthlyBudget,
  getBudgetMonthRange,
  validateTransactionSplits,
} from '@/app/budget/_lib/budget'
import type { Json } from '@/types/database'
import type {
  BudgetCategory,
  BudgetGroup,
  BudgetTransaction,
  BudgetTransactionSplit,
  MonthlyBudget,
  MonthlyBudgetAllocation,
} from '@/types'

interface UseBudgetOptions {
  familyId?: string | null
  month: string
}

export interface CreateTransactionInput {
  amount: number
  occurredOn: string
  merchant: string
  note?: string
  splits: Array<{ categoryId: string; amount: number }>
}

const realtimeTables = [
  'budget_groups',
  'budget_categories',
  'monthly_budgets',
  'monthly_budget_allocations',
  'budget_transactions',
  'budget_transaction_splits',
] as const

export function useBudget({ familyId, month }: UseBudgetOptions) {
  const { supabase, user } = useSupabase()
  const [groups, setGroups] = useState<BudgetGroup[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [budget, setBudget] = useState<MonthlyBudget | null>(null)
  const [previousBudget, setPreviousBudget] = useState<MonthlyBudget | null>(null)
  const [allocations, setAllocations] = useState<MonthlyBudgetAllocation[]>([])
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([])
  const [splits, setSplits] = useState<BudgetTransactionSplit[]>([])
  const [loading, setLoading] = useState(true)
  const [mutating, setMutating] = useState(false)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const fetchBudget = useCallback(async (showLoading = false) => {
    const currentRequest = ++requestId.current
    if (!user) {
      setLoading(false)
      return
    }
    if (showLoading) setLoading(true)
    setError(null)

    const { start, end } = getBudgetMonthRange(month)
    const groupQuery = supabase
      .from('budget_groups')
      .select('*')
      .is('archived_at', null)
      .order('sort_order')
      .order('name')
    const budgetQuery = supabase
      .from('monthly_budgets')
      .select('*')
      .eq('month', start)
    const previousQuery = supabase
      .from('monthly_budgets')
      .select('*')
      .lt('month', start)
      .order('month', { ascending: false })
      .limit(1)
    const transactionQuery = supabase
      .from('budget_transactions')
      .select('*')
      .gte('occurred_on', start)
      .lt('occurred_on', end)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })

    const scopedGroups = familyId
      ? groupQuery.eq('family_id', familyId)
      : groupQuery.is('family_id', null).eq('user_id', user.id)
    const scopedBudget = familyId
      ? budgetQuery.eq('family_id', familyId)
      : budgetQuery.is('family_id', null).eq('user_id', user.id)
    const scopedPrevious = familyId
      ? previousQuery.eq('family_id', familyId)
      : previousQuery.is('family_id', null).eq('user_id', user.id)
    const scopedTransactions = familyId
      ? transactionQuery.eq('family_id', familyId)
      : transactionQuery.is('family_id', null).eq('user_id', user.id)

    const [groupResult, categoryResult, budgetResult, previousResult, transactionResult] = await Promise.all([
      scopedGroups,
      supabase.from('budget_categories').select('*').is('archived_at', null).order('sort_order').order('name'),
      scopedBudget.maybeSingle(),
      scopedPrevious.maybeSingle(),
      scopedTransactions,
    ])

    const firstError = groupResult.error
      ?? categoryResult.error
      ?? budgetResult.error
      ?? previousResult.error
      ?? transactionResult.error
    if (firstError) {
      if (currentRequest === requestId.current) {
        setError(firstError.message)
        setLoading(false)
      }
      return
    }

    const visibleGroups = groupResult.data ?? []
    const groupIds = new Set(visibleGroups.map(({ id }) => id))
    const visibleCategories = (categoryResult.data ?? []).filter(({ group_id }) => groupIds.has(group_id))
    const currentBudget = budgetResult.data
    const currentTransactions = transactionResult.data ?? []

    const [allocationResult, splitResult] = await Promise.all([
      currentBudget
        ? supabase.from('monthly_budget_allocations').select('*').eq('monthly_budget_id', currentBudget.id)
        : Promise.resolve({ data: [] as MonthlyBudgetAllocation[], error: null }),
      currentTransactions.length > 0
        ? supabase.from('budget_transaction_splits').select('*').in('transaction_id', currentTransactions.map(({ id }) => id))
        : Promise.resolve({ data: [] as BudgetTransactionSplit[], error: null }),
    ])

    if (currentRequest !== requestId.current) return
    if (allocationResult.error || splitResult.error) {
      setError((allocationResult.error ?? splitResult.error)?.message ?? 'Unable to load budget details')
      setLoading(false)
      return
    }

    setGroups(visibleGroups)
    setCategories(visibleCategories)
    setBudget(currentBudget)
    setPreviousBudget(previousResult.data)
    setAllocations(allocationResult.data ?? [])
    setTransactions(currentTransactions)
    setSplits(splitResult.data ?? [])
    setLoading(false)
  }, [familyId, month, supabase, user])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchBudget(true), 0)
    return () => window.clearTimeout(timeoutId)
  }, [fetchBudget])

  useEffect(() => {
    if (!user) return
    let refreshTimer: number | undefined
    const handleChange = () => {
      window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => void fetchBudget(), 120)
    }

    let channel = supabase.channel(`budget:${familyId ?? user.id}:${month}`)
    for (const table of realtimeTables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        handleChange,
      )
    }
    channel.subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'))

    return () => {
      window.clearTimeout(refreshTimer)
      void supabase.removeChannel(channel)
    }
  }, [familyId, fetchBudget, month, supabase, user])

  const runMutation = useCallback(async (operation: () => Promise<void>) => {
    setMutating(true)
    setError(null)
    try {
      await operation()
      await fetchBudget()
      return true
    } catch (mutationError) {
      setError(getErrorMessage(mutationError))
      return false
    } finally {
      setMutating(false)
    }
  }, [fetchBudget])

  const createBudget = useCallback((income = 0) => runMutation(async () => {
    if (!user) throw new Error('Not authenticated')
    const { error: insertError } = await supabase.from('monthly_budgets').insert({
      user_id: user.id,
      family_id: familyId ?? null,
      month,
      income,
      created_by: user.id,
    })
    if (insertError) throw insertError
  }), [familyId, month, runMutation, supabase, user])

  const copyPreviousMonth = useCallback(() => runMutation(async () => {
    if (!previousBudget) throw new Error('There is no earlier budget to copy')
    const { error: copyError } = await supabase.rpc('copy_budget_month', {
      source_budget_id: previousBudget.id,
      target_month: month,
    })
    if (copyError) throw copyError
  }), [month, previousBudget, runMutation, supabase])

  const updateIncome = useCallback((income: number) => runMutation(async () => {
    if (!budget) throw new Error('Create this month first')
    const { error: updateError } = await supabase
      .from('monthly_budgets')
      .update({ income })
      .eq('id', budget.id)
    if (updateError) throw updateError
  }), [budget, runMutation, supabase])

  const createGroup = useCallback((name: string) => runMutation(async () => {
    if (!user || !name.trim()) throw new Error('Group name is required')
    const { error: insertError } = await supabase.from('budget_groups').insert({
      user_id: user.id,
      family_id: familyId ?? null,
      name: name.trim(),
      sort_order: groups.length,
    })
    if (insertError) throw insertError
  }), [familyId, groups.length, runMutation, supabase, user])

  const archiveGroup = useCallback((groupId: string) => runMutation(async () => {
    const { error: updateError } = await supabase
      .from('budget_groups')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', groupId)
    if (updateError) throw updateError
  }), [runMutation, supabase])

  const createCategory = useCallback((groupId: string, name: string) => runMutation(async () => {
    if (!name.trim()) throw new Error('Category name is required')
    const { error: insertError } = await supabase.from('budget_categories').insert({
      group_id: groupId,
      name: name.trim(),
      sort_order: categories.filter((category) => category.group_id === groupId).length,
    })
    if (insertError) throw insertError
  }), [categories, runMutation, supabase])

  const archiveCategory = useCallback((categoryId: string) => runMutation(async () => {
    const { error: updateError } = await supabase
      .from('budget_categories')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', categoryId)
    if (updateError) throw updateError
  }), [runMutation, supabase])

  const updateAllocation = useCallback((categoryId: string, plannedAmount: number) => runMutation(async () => {
    if (!budget) throw new Error('Create this month before assigning money')
    const existing = allocations.find((allocation) => allocation.category_id === categoryId)
    const { error: upsertError } = await supabase.from('monthly_budget_allocations').upsert({
      monthly_budget_id: budget.id,
      category_id: categoryId,
      planned_amount: plannedAmount,
      rollover_amount: existing?.rollover_amount ?? 0,
    }, { onConflict: 'monthly_budget_id,category_id' })
    if (upsertError) throw upsertError
  }), [allocations, budget, runMutation, supabase])

  const createTransaction = useCallback((input: CreateTransactionInput) => runMutation(async () => {
    if (!user) throw new Error('Not authenticated')
    const validationError = validateTransactionSplits(input.amount, input.splits)
    if (validationError) throw new Error(validationError)

    const categorySplits = input.splits.map((split) => ({
      category_id: split.categoryId,
      amount: split.amount,
    })) as Json
    const { error: transactionError } = await supabase.rpc('create_budget_transaction', {
      owner_id: user.id,
      fam_id: familyId ?? null,
      transaction_amount: input.amount,
      transaction_date: input.occurredOn,
      transaction_merchant: input.merchant,
      transaction_note: input.note ?? '',
      category_splits: categorySplits,
    })
    if (transactionError) throw transactionError
  }), [familyId, runMutation, supabase, user])

  const deleteTransaction = useCallback((transactionId: string) => runMutation(async () => {
    const transaction = transactions.find(({ id }) => id === transactionId)
    if (transaction?.source === 'debt_payment') {
      throw new Error('Debt payment transactions are managed from the loan payment history')
    }
    const { error: deleteError } = await supabase.from('budget_transactions').delete().eq('id', transactionId)
    if (deleteError) throw deleteError
  }), [runMutation, supabase, transactions])

  const summary = useMemo(() => calculateMonthlyBudget(
    budget,
    groups,
    categories,
    allocations,
    transactions,
    splits,
  ), [allocations, budget, categories, groups, splits, transactions])

  return {
    groups,
    categories,
    budget,
    previousBudget,
    allocations,
    transactions,
    splits,
    summary,
    loading,
    mutating,
    error,
    realtimeConnected,
    refetch: fetchBudget,
    createBudget,
    copyPreviousMonth,
    updateIncome,
    createGroup,
    archiveGroup,
    createCategory,
    archiveCategory,
    updateAllocation,
    createTransaction,
    deleteTransaction,
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}
