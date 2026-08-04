'use client';

import { useState } from 'react';
import { usePayments } from '@/hooks/usePayments';
import { formatCurrency } from '@/lib/snowball';
import type { Loan } from '@/types';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { AppTextField } from './AppTextField';
import { InputAdornment } from '@mui/material';

interface PaymentButtonProps {
  loan: Loan;
  onSuccess?: () => void;
}

export function PaymentButtons({ loan, onSuccess }: PaymentButtonProps) {
  const { makeMinPayment, makeExtraPayment, submitting } = usePayments();
  const [showExtraInput, setShowExtraInput] = useState(false);
  const [extraAmount, setExtraAmount] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleMin = async () => {
    const result = await makeMinPayment(loan);
    if (result.success) {
      setFeedback(`✓ Payment of ${formatCurrency(loan.min_payment)} recorded`);
      setTimeout(() => setFeedback(null), 3000);
      onSuccess?.();
    }
  };

  const handleExtra = async () => {
    const amount = parseFloat(extraAmount);
    if (isNaN(amount) || amount <= 0) return;
    const result = await makeExtraPayment(loan, amount, extraNote || undefined);
    if (result.success) {
      setFeedback(`✓ Extra payment of ${formatCurrency(amount)} recorded`);
      setShowExtraInput(false);
      setExtraAmount('');
      setExtraNote('');
      setTimeout(() => setFeedback(null), 3000);
      onSuccess?.();
    }
  };

  if (feedback) {
    return (
      <div
        className="text-center py-3 px-4 rounded-xl text-sm font-medium"
        style={{
          background: 'rgba(16,212,126,0.1)',
          border: '1px solid rgba(16,212,126,0.3)',
          color: 'var(--accent-green)',
        }}
      >
        {feedback}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!showExtraInput ? (
        <div className="flex gap-2">
          {/* Min payment button */}
          <PrimaryButton
            onClick={handleMin}
            disabled={submitting}
            sx={{ flex: 1 }}
          >
            {submitting
              ? 'Processing...'
              : `Pay Min · ${formatCurrency(loan.min_payment)}`}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => setShowExtraInput(true)}
            disabled={submitting}
          >
            + Extra
          </SecondaryButton>
        </div>
      ) : (
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Extra Principal Payment
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <AppTextField
                onChange={(e) => setExtraAmount(e.target.value)}
                value={extraAmount}
                type="number"
                placeholder="0.00"
                autoFocus
                startAdornment={
                  <InputAdornment position="start">$</InputAdornment>
                }
                sx={{ background: 'var(--surface)', borderRadius: '8px' }}
              />
            </div>
          </div>
          <AppTextField
            value={extraNote}
            onChange={(e) => setExtraNote(e.target.value)}
            placeholder="Note (optional)"
            sx={{ background: 'var(--surface)', borderRadius: '8px' }}
          />
          <div className="flex gap-2">
            <PrimaryButton
              onClick={handleExtra}
              disabled={submitting || !extraAmount}
              sx={{ flex: 1 }}
              size="small"
            >
              {submitting ? 'Processing...' : 'Apply Payment'}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setShowExtraInput(false);
                setExtraAmount('');
                setExtraNote('');
              }}
              size="small"
            >
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
