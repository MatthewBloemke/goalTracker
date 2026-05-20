'use client'

import { useState } from 'react'
import { useFamily } from '@/hooks/useFamily'
import { useLoans } from '@/hooks/useLoans'
import { LoanCard } from '@/components/ui/LoanCard'
import { LoanForm } from '@/components/ui/LoanForm'
import { formatCurrency } from '@/lib/snowball'

export default function LoansPage() {
  const { family, settings } = useFamily()
  const { summary, loading, refetch } = useLoans({
    familyId: family?.id,
    strategy: settings?.strategy ?? 'snowball',
    extraMonthlyBudget: settings?.extra_monthly_budget ?? 0,
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [showPaidOff, setShowPaidOff] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const activeLoans = summary?.ordered_loans.filter(l => l.is_active && l.current_balance > 0) ?? []
  const paidOffLoans = summary?.ordered_loans.filter(l => !l.is_active || l.current_balance === 0) ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl" style={{ color: 'var(--text-primary)' }}>Loans</h1>
          {summary && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {activeLoans.length} active · {formatCurrency(summary.total_current)} remaining
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-[1.02]"
          style={{ background: 'var(--accent-green)', color: 'white' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Loan
        </button>
      </div>

      {/* Add loan form */}
      {showAddForm && (
        <div className="rounded-2xl p-6 glass">
          <h2 className="font-serif text-xl mb-5" style={{ color: 'var(--text-primary)' }}>New Loan</h2>
          <LoanForm
            familyId={family?.id}
            onSuccess={() => { setShowAddForm(false); refetch() }}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Empty state */}
      {activeLoans.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-secondary)' }}>
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No loans yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Add your first loan to get started</p>
          </div>
        </div>
      )}

      {/* Active loans */}
      {activeLoans.length > 0 && (
        <div className="flex flex-col gap-3">
          {activeLoans.map((loan, i) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              position={i + 1}
              isTarget={i === 0}
              onUpdate={refetch}
            />
          ))}
        </div>
      )}

      {/* Paid off loans */}
      {paidOffLoans.length > 0 && (
        <div>
          <button
            onClick={() => setShowPaidOff(v => !v)}
            className="flex items-center gap-2 text-sm mb-3"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ transform: showPaidOff ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
            {paidOffLoans.length} paid off loan{paidOffLoans.length !== 1 ? 's' : ''}
          </button>

          {showPaidOff && (
            <div className="flex flex-col gap-3">
              {paidOffLoans.map((loan, i) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  position={activeLoans.length + i + 1}
                  isTarget={false}
                  onUpdate={refetch}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
