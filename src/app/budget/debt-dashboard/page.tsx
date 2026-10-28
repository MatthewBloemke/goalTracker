'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dayjs from 'dayjs'
import { Box, Button, Card, InputAdornment, Stack, Typography } from '@mui/material'
import { useFamily } from '@/hooks/useFamily'
import { useLoans } from '@/app/budget/_hooks/useLoans'
import { Thermometer } from '@/app/budget/_components/debt/Thermometer'
import { TotalProgressBar } from '@/app/budget/_components/debt/TotalProgressBar'
import { PaymentButtons } from '@/app/budget/_components/debt/PaymentButton'
import { AppTextField } from '@/components/ui/AppTextField'
import { formatCurrency, formatMonthsRemaining } from '@/app/budget/_lib/snowball'

export default function DebtDashboardPage() {
  const { family, settings, loading: familyLoading } = useFamily()
  const [currentMonthExtra, setCurrentMonthExtra] = useState('')
  const currentMonthKey = useMemo(() => {
    const owner = family?.id ?? 'family-required'
    return `debt-snowball:current-month-extra:${owner}:${dayjs().format('YYYY-MM')}`
  }, [family?.id])
  const parsedCurrentMonthExtra = Number(currentMonthExtra) > 0 ? Number(currentMonthExtra) : 0

  const { summary, loading: loansLoading } = useLoans({
    familyId: family?.id,
    strategy: settings?.strategy ?? 'snowball',
    extraMonthlyBudget: settings?.extra_monthly_budget ?? 0,
    currentMonthExtraPayment: parsedCurrentMonthExtra,
  })
  const loading = familyLoading || loansLoading

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentMonthExtra(localStorage.getItem(currentMonthKey) ?? '')
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [currentMonthKey])

  const handleCurrentMonthExtraChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setCurrentMonthExtra(value)
    if (value === '') localStorage.removeItem(currentMonthKey)
    else localStorage.setItem(currentMonthKey, value)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2" style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
          <p className="text-sm text-[var(--text-secondary)]">Loading your debt snapshot...</p>
        </div>
      </div>
    )
  }

  if (!family) return null

  if (!summary || summary.ordered_loans.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
          <DebtIcon size={36} />
        </div>
        <div>
          <h1 className="font-serif text-2xl text-[var(--text-primary)]">No loans yet</h1>
          <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
            Add your first loan to visualize your payoff strategy and track your path to financial freedom.
          </p>
        </div>
        <Button component={Link} href="/budget/debts" variant="contained" sx={{ px: 3, py: 1.5 }}>
          Add Your First Loan
        </Button>
      </div>
    )
  }

  const { current_target, next_target } = summary

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-green)]">Debt payoff</p>
          <h1 className="mt-1 font-serif text-3xl text-[var(--text-primary)]">
            {family.name} Debt Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {settings?.strategy === 'avalanche' ? 'Avalanche' : 'Snowball'} strategy
            {settings?.extra_monthly_budget ? ` · +${formatCurrency(settings.extra_monthly_budget)}/mo extra` : ''}
          </p>
        </div>
        <Button component={Link} href="/budget/debts" variant="outlined" color="inherit">
          Manage Loans
        </Button>
      </div>

      {current_target && (
        <div className="glass flex flex-col items-center gap-8 rounded-2xl p-8">
          <Thermometer loan={current_target} />
          <div className="w-full max-w-sm"><PaymentButtons loan={current_target} /></div>
        </div>
      )}

      <Card sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="overline" color="text.secondary">{dayjs().format('MMMM')} Extra Principal</Typography>
            <Typography variant="h6" color="text.primary">
              {parsedCurrentMonthExtra > 0 ? `${formatCurrency(parsedCurrentMonthExtra)} queued` : 'No extra queued'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Debt-free date: {summary.debt_free_date ? dayjs(summary.debt_free_date).format('MMM YYYY') : 'N/A'}
            </Typography>
          </Box>
          <Box sx={{ width: { xs: '100%', sm: 220 } }}>
            <AppTextField
              value={currentMonthExtra}
              onChange={handleCurrentMonthExtraChange}
              type="number"
              placeholder="0.00"
              slotProps={{
                htmlInput: { min: 0, step: '0.01' },
                input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
              }}
            />
          </Box>
        </Stack>
      </Card>

      {next_target && (
        <div className="glass rounded-2xl p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--text-secondary)]">Up Next</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--text-primary)]">{next_target.name}</p>
              {next_target.lender && <p className="text-sm text-[var(--text-secondary)]">{next_target.lender}</p>}
            </div>
            <div className="text-right">
              <p className="numeric-value text-xl font-medium text-[var(--text-primary)]">{formatCurrency(next_target.current_balance)}</p>
              <p className="numeric-value mt-0.5 text-xs text-[var(--text-secondary)]">{formatMonthsRemaining(next_target.months_remaining)} remaining</p>
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full bg-[var(--accent-blue)]" style={{ width: `${next_target.percent_paid}%` }} />
          </div>
          <p className="numeric-value mt-1 text-right text-xs text-[var(--text-secondary)]">{next_target.percent_paid.toFixed(1)}% paid</p>
        </div>
      )}

      {summary.ordered_loans.length > 2 && (
        <div className="glass rounded-2xl p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[var(--text-secondary)]">Payoff Queue</p>
          <div className="flex flex-col gap-3">
            {summary.ordered_loans.slice(2).map((loan, index) => (
              <div key={loan.id} className="flex items-center gap-3">
                <span className="numeric-value w-5 text-center text-xs text-[var(--text-secondary)]">{index + 3}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div className="h-full rounded-full bg-[var(--border)]" style={{ width: `${loan.percent_paid}%` }} />
                </div>
                <span className="min-w-25 text-sm text-[var(--text-secondary)]">{loan.name}</span>
                <span className="numeric-value min-w-20 text-right text-sm font-medium text-[var(--text-primary)]">{formatCurrency(loan.current_balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TotalProgressBar summary={summary} />
    </div>
  )
}

function DebtIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-secondary)]">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" />
    </svg>
  )
}
