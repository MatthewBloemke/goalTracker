'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import type { Payment } from '@/types'

export function usePaymentHistory(loanId: string | null) {
  const { supabase } = useSupabase()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!loanId) return
    setLoading(true)
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('loan_id', loanId)
      .order('paid_at', { ascending: false })
      .limit(50)
    setPayments((data ?? []) as Payment[])
    setLoading(false)
  }, [supabase, loanId])

  useEffect(() => {
    let cancelled = false
    const run = async () => { if (!cancelled) await fetch() }
    run()
    return () => { cancelled = true }
  }, [fetch])

  // Realtime
  useEffect(() => {
    if (!loanId) return
    const channel = supabase
      .channel(`payments-${loanId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'payments',
        filter: `loan_id=eq.${loanId}`,
      }, () => fetch())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, loanId, fetch])

  return { payments, loading, refetch: fetch }
}
