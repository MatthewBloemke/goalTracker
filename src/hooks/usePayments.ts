'use client';

import { useState, useCallback } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { applyPayment } from '@/lib/snowball';
import type { Loan, Payment, PaymentType, InsertPayment } from '@/types';

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
        const { balance_after } = applyPayment(loan, amount);
        const roundedBalance = Math.round(balance_after * 100) / 100;

        // Insert payment record
        const paymentInsert: InsertPayment = {
          loan_id: loan.id,
          user_id: user.id,
          amount,
          type,
          note: note ?? null,
          balance_after: roundedBalance,
        };
        const { data: payment, error: paymentError } = await supabase
          .from('payments')
          .insert(paymentInsert)
          .select()
          .single();

        if (paymentError) throw paymentError;

        // Update loan balance
        const updates: Partial<Loan> = { current_balance: roundedBalance };
        if (roundedBalance === 0) {
          updates.is_active = false;
          updates.paid_off_at = new Date().toISOString();
        }

        const { error: loanError } = await supabase
          .from('loans')
          .update(updates)
          .eq('id', loan.id);

        if (loanError) throw loanError;

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
