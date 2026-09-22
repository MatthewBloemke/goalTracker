'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import type { Payment } from '@/types'

export function usePaymentHistory(loanId: string | null) {
  const { supabase } = useSupabase()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const fetch = useCallback(async () => {
    const requestId = ++requestIdRef.current

    if (!loanId) {
      setPayments([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('loan_id', loanId)
      .order('paid_at', { ascending: false })
      .limit(50)

    if (requestId !== requestIdRef.current) return
    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    setPayments((data ?? []) as Payment[])
    setLoading(false)
  }, [supabase, loanId])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
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

  return { payments, loading, error, refetch: fetch }
}
