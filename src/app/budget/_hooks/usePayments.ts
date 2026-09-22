'use client';

import { useState, useCallback } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import type { Loan, Payment, PaymentType } from '@/types';

export function usePayments() {
  const { supabase, user } = useSupabase();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makePayment = useCallback(
    async (
      loan: Loan,
      amount: number,
      type: PaymentType,
      note?: string,
    ): Promise<{ success: boolean; payment?: Payment }> => {
      if (!user) {
        setError('Not authenticated');
        return { success: false };
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        setError('Payment amount must be greater than 0');
        return { success: false };
      }

      setSubmitting(true);
      setError(null);

      try {
        const { data: paymentId, error: paymentError } = await supabase.rpc(
          'record_loan_payment',
          {
            target_loan_id: loan.id,
            payment_amount: amount,
            payment_kind: type,
            payment_note: note ?? null,
          },
        );
        if (paymentError) throw paymentError;

        const { data: payment, error: fetchError } = await supabase
          .from('payments')
          .select('*')
          .eq('id', paymentId)
          .single();
        if (fetchError) throw fetchError;

        return { success: true, payment: payment as Payment };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Payment failed');
        return { success: false };
      } finally {
        setSubmitting(false);
      }
    },
    [supabase, user],
  );

  const makeMinPayment = useCallback(
    (loan: Loan) => {
      return makePayment(loan, loan.min_payment, 'minimum');
    },
    [makePayment],
  );

  const makeExtraPayment = useCallback(
    (loan: Loan, amount: number, note?: string) => {
      return makePayment(loan, amount, 'extra', note);
    },
    [makePayment],
  );

  const fetchPaymentHistory = useCallback(
    async (loanId: string): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('loan_id', loanId)
        .order('paid_at', { ascending: false })
        .limit(50);

      if (error) return [];
      return data as Payment[];
    },
    [supabase],
  );

  return {
    makePayment,
    makeMinPayment,
    makeExtraPayment,
    fetchPaymentHistory,
    submitting,
    error,
  };
}
