'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '@/lib/snowball'
import type { SnowballSummary } from '@/types'
import dayjs from 'dayjs'

interface TotalProgressBarProps {
  summary: SnowballSummary
}

export function TotalProgressBar({ summary }: TotalProgressBarProps) {
  const [displayPercent, setDisplayPercent] = useState(0)
  const targetPercent = summary.percent_complete
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const duration = 1400
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayPercent(targetPercent * eased)
      if (progress < 1) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [targetPercent])

  const debtFreeText = summary.debt_free_date
    ? dayjs(summary.debt_free_date).format('MMM YYYY')
    : '—'

  return (
    <div className="w-full px-6 py-4 rounded-2xl glass">
      <div className="flex justify-between items-end mb-3">
        <div>
          <p className="text-xs tracking-widest uppercase font-medium" style={{ color: 'var(--text-secondary)' }}>
            Total Debt Eliminated
          </p>
          <p className="font-serif text-2xl mt-0.5" style={{ color: 'var(--accent-green)' }}>
            {formatCurrency(summary.total_paid)}
            <span className="text-sm font-sans ml-2" style={{ color: 'var(--text-secondary)' }}>
              of {formatCurrency(summary.total_original)}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Debt-Free Date</p>
          <p className="font-serif text-lg" style={{ color: 'var(--text-primary)' }}>{debtFreeText}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${displayPercent}%`,
            background: 'linear-gradient(90deg, var(--accent-green-dim), var(--accent-green), #6ee7b7)',
            boxShadow: '0 0 12px rgba(16,212,126,0.4)',
          }}
        />
        {/* Milestone markers */}
        {[25, 50, 75].map(pct => (
          <div
            key={pct}
            className="absolute top-0 bottom-0 w-px"
            style={{
              left: `${pct}%`,
              background: 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>

      {/* Loan breakdown dots */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {summary.ordered_loans.map((loan, i) => (
          <div key={loan.id} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: loan.current_balance === 0
                  ? 'var(--accent-green)'
                  : i === 0
                  ? 'var(--accent-amber)'
                  : 'var(--border)',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {loan.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
