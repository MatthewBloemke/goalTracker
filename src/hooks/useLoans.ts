'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import { buildSnowballSummary } from '@/lib/snowball'
import type { Loan, SnowballSummary, SnowballStrategy } from '@/types'

interface UseLoansOptions {
  familyId?: string | null
  strategy?: SnowballStrategy
  extraMonthlyBudget?: number
}

export function useLoans({
  familyId,
  strategy = 'snowball',
  extraMonthlyBudget = 0,
}: UseLoansOptions = {}) {
  const { supabase, user } = useSupabase()
  const [loans, setLoans] = useState<Loan[]>([])
  const [summary, setSummary] = useState<SnowballSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLoans = useCallback(async () => {
    if (!user) return
    setError(null)

    let query = supabase
      .from('loans')
      .select('*')
      .order('snowball_order', { ascending: true, nullsFirst: false })

    if (familyId) {
      query = query.eq('family_id', familyId)
    } else {
      query = query.eq('user_id', user.id)
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
      return
    }

    const loanData = data as Loan[]
    setLoans(loanData)
    setSummary(buildSnowballSummary(loanData, strategy, extraMonthlyBudget))
    setLoading(false)
  }, [supabase, user, familyId, strategy, extraMonthlyBudget])

  // Initial fetch
  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  // Realtime subscription
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('loans-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loans',
          filter: familyId ? `family_id=eq.${familyId}` : `user_id=eq.${user.id}`,
        },
        () => {
          // Re-fetch on any change — keeps logic simple and consistent
          fetchLoans()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, user, familyId, fetchLoans])

  return { loans, summary, loading, error, refetch: fetchLoans }
}
