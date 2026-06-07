'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { buildSnowballSummary } from '@/lib/snowball';
import type { Loan, SnowballSummary, SnowballStrategy } from '@/types';

interface UseLoansOptions {
  familyId?: string | null;
  strategy?: SnowballStrategy;
  extraMonthlyBudget?: number;
  currentMonthExtraPayment?: number;
}

export function useLoans({
  familyId,
  strategy = 'snowball',
  extraMonthlyBudget = 0,
  currentMonthExtraPayment = 0,
}: UseLoansOptions = {}) {
  const { supabase, user } = useSupabase();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchLoans = useCallback(
    async (showLoading = false) => {
      const requestId = ++requestIdRef.current;

      if (!user) {
        setLoans([]);
        setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);
      setError(null);

      const query = supabase
        .from('loans')
        .select('*')
        .order('snowball_order', { ascending: true, nullsFirst: false });

      const { data, error: fetchError } = await (familyId
        ? query.eq('family_id', familyId)
        : query.eq('user_id', user.id));

      if (requestId !== requestIdRef.current) return;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setLoans((data ?? []) as Loan[]);
      setLoading(false);
    },
    [supabase, user, familyId],
  );

  // Initial fetch — cancellable to prevent stale state on fast re-mounts
  useEffect(() => {
    void Promise.resolve().then(() => fetchLoans(true));
  }, [fetchLoans]);

  // Realtime subscription — silent refetch, no loading spinner
  useEffect(() => {
    if (!user) return;

    const filter = familyId
      ? `family_id=eq.${familyId}`
      : `user_id=eq.${user.id}`;

    const channel = supabase
      .channel(`loans-realtime-${familyId ?? user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans', filter },
        () => fetchLoans(false),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user, familyId, fetchLoans]);

  const summary = useMemo<SnowballSummary | null>(
    () =>
      loans.length > 0
        ? buildSnowballSummary(
            loans,
            strategy,
            extraMonthlyBudget,
            currentMonthExtraPayment,
          )
        : null,
    [loans, strategy, extraMonthlyBudget, currentMonthExtraPayment],
  );

  return { loans, summary, loading, error, refetch: () => fetchLoans(true) };
}
