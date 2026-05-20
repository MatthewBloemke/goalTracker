'use client'

import { useState } from 'react'
import { usePayments } from '@/hooks/usePayments'
import { formatCurrency } from '@/lib/snowball'
import type { Loan } from '@/types'

interface PaymentButtonProps {
  loan: Loan
  onSuccess?: () => void
}

export function PaymentButtons({ loan, onSuccess }: PaymentButtonProps) {
  const { makeMinPayment, makeExtraPayment, submitting } = usePayments()
  const [showExtraInput, setShowExtraInput] = useState(false)
  const [extraAmount, setExtraAmount] = useState('')
  const [extraNote, setExtraNote] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleMin = async () => {
    const result = await makeMinPayment(loan)
    if (result.success) {
      setFeedback(`✓ Payment of ${formatCurrency(loan.min_payment)} recorded`)
      setTimeout(() => setFeedback(null), 3000)
      onSuccess?.()
    }
  }

  const handleExtra = async () => {
    const amount = parseFloat(extraAmount)
    if (isNaN(amount) || amount <= 0) return
    const result = await makeExtraPayment(loan, amount, extraNote || undefined)
    if (result.success) {
      setFeedback(`✓ Extra payment of ${formatCurrency(amount)} recorded`)
      setShowExtraInput(false)
      setExtraAmount('')
      setExtraNote('')
      setTimeout(() => setFeedback(null), 3000)
      onSuccess?.()
    }
  }

  if (feedback) {
    return (
      <div className="text-center py-3 px-4 rounded-xl text-sm font-medium"
        style={{ background: 'rgba(16,212,126,0.1)', border: '1px solid rgba(16,212,126,0.3)', color: 'var(--accent-green)' }}>
        {feedback}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {!showExtraInput ? (
        <div className="flex gap-2">
          {/* Min payment button */}
          <button
            onClick={handleMin}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl font-medium text-sm transition-all duration-150 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, var(--accent-green-dim), var(--accent-green))',
              color: 'white',
              boxShadow: '0 4px 15px rgba(16,212,126,0.25)',
            }}
          >
            {submitting ? 'Processing...' : `Pay Min · ${formatCurrency(loan.min_payment)}`}
          </button>

          {/* Extra payment button */}
          <button
            onClick={() => setShowExtraInput(true)}
            disabled={submitting}
            className="px-4 py-3 rounded-xl font-medium text-sm transition-all duration-150 hover:scale-[1.02] active:scale-[0.97]"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            + Extra
          </button>
        </div>
      ) : (
        <div className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Extra Principal Payment
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-secondary)' }}>$</span>
              <input
                type="number"
                value={extraAmount}
                onChange={e => setExtraAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                autoFocus
              />
            </div>
          </div>
          <input
            type="text"
            value={extraNote}
            onChange={e => setExtraNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleExtra}
              disabled={submitting || !extraAmount}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm disabled:opacity-50"
              style={{ background: 'var(--accent-green)', color: 'white' }}
            >
              {submitting ? 'Processing...' : 'Apply Payment'}
            </button>
            <button
              onClick={() => { setShowExtraInput(false); setExtraAmount(''); setExtraNote('') }}
              className="px-4 py-2.5 rounded-lg text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
