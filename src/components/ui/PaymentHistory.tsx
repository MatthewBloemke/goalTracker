'use client'

import { usePaymentHistory } from '@/hooks/usePaymentHistory'
import { formatCurrency } from '@/lib/snowball'
import dayjs from 'dayjs'
import type { PaymentType } from '@/types'

interface PaymentHistoryProps {
  loanId: string
}

const typeLabel: Record<PaymentType, { label: string; color: string }> = {
  minimum: { label: 'Min', color: 'var(--text-secondary)' },
  extra:   { label: 'Extra', color: 'var(--accent-green)' },
  manual:  { label: 'Manual', color: 'var(--accent-amber)' },
}

export function PaymentHistory({ loanId }: PaymentHistoryProps) {
  const { payments, loading, error } = usePaymentHistory(loanId)

  if (loading) return (
    <div className="flex justify-center py-6">
      <div className="w-5 h-5 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (error) return (
    <p className="text-sm py-4 text-center" style={{ color: 'var(--accent-red)' }}>
      {error}
    </p>
  )

  if (payments.length === 0) return (
    <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
      No payments recorded yet
    </p>
  )

  return (
    <div className="flex flex-col">
      {payments.map((payment, i) => {
        const { label, color } = typeLabel[payment.type]
        return (
          <div
            key={payment.id}
            className="flex items-center gap-3 py-3"
            style={{ borderBottom: i < payments.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            {/* Type badge */}
            <span
              className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
              style={{ background: 'var(--surface-2)', color }}
            >
              {label}
            </span>

            {/* Date + note */}
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {dayjs(payment.paid_at).format('MMM D, YYYY')}
              </p>
              {payment.note && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {payment.note}
                </p>
              )}
            </div>

            {/* Amount + balance after */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-medium" style={{ color: 'var(--accent-green)' }}>
                -{formatCurrency(payment.amount)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                → {formatCurrency(payment.balance_after)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
