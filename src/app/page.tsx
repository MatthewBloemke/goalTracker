'use client';

import { useFamily } from '@/hooks/useFamily';
import { useLoans } from '@/hooks/useLoans';
import { Thermometer } from '@/components/ui/Thermometer';
import { TotalProgressBar } from '@/components/ui/TotalProgressBar';
import { PaymentButtons } from '@/components/ui/PaymentButton';
import Link from 'next/link';
import { formatCurrency, formatMonthsRemaining } from '@/lib/snowball';

export default function DashboardPage() {
  const { family, settings, loading: familyLoading } = useFamily();
  const { summary, loading: loansLoading } = useLoans({
    familyId: family?.id,
    strategy: settings?.strategy ?? 'snowball',
    extraMonthlyBudget: settings?.extra_monthly_budget ?? 0,
  });

  const loading = familyLoading || loansLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{
              borderColor: 'var(--accent-green)',
              borderTopColor: 'transparent',
            }}
          />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Loading your snapshot...
          </p>
        </div>
      </div>
    );
  }

  if (!summary || summary.ordered_loans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <path
              d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div>
          <h2
            className="font-serif text-2xl"
            style={{ color: 'var(--text-primary)' }}
          >
            No loans yet
          </h2>
          <p
            className="mt-2 text-sm max-w-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            Add your first loan to start visualizing your debt snowball and
            track your path to financial freedom.
          </p>
        </div>
        <Link
          href="/loans"
          className="px-6 py-3 rounded-xl font-medium text-sm transition-all hover:scale-[1.02]"
          style={{ background: 'var(--accent-green)', color: 'white' }}
        >
          Add Your First Loan
        </Link>
      </div>
    );
  }

  const { current_target, next_target } = summary;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="font-serif text-3xl"
            style={{ color: 'var(--text-primary)' }}
          >
            {family ? family.name : 'My Dashboard'}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            {settings?.strategy === 'avalanche' ? 'Avalanche' : 'Snowball'}{' '}
            strategy
            {settings?.extra_monthly_budget
              ? ` · +${formatCurrency(settings.extra_monthly_budget)}/mo extra`
              : ''}
          </p>
        </div>
        <Link
          href="/loans"
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          Manage Loans
        </Link>
      </div>

      {/* Main thermometer + payment buttons */}
      {current_target && (
        <div className="rounded-2xl p-8 glass flex flex-col items-center gap-8">
          <Thermometer loan={current_target} />
          <div className="w-full max-w-sm">
            <PaymentButtons loan={current_target} />
          </div>
        </div>
      )}

      {/* Next target preview */}
      {next_target && (
        <div className="rounded-2xl p-5 glass">
          <p
            className="text-xs tracking-widest uppercase font-medium mb-3"
            style={{ color: 'var(--text-secondary)' }}
          >
            Up Next
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p
                className="font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {next_target.name}
              </p>
              {next_target.lender && (
                <p
                  className="text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {next_target.lender}
                </p>
              )}
            </div>
            <div className="text-right">
              <p
                className="font-serif text-xl"
                style={{ color: 'var(--text-primary)' }}
              >
                {formatCurrency(next_target.current_balance)}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                {formatMonthsRemaining(next_target.months_remaining)} remaining
              </p>
            </div>
          </div>
          {/* Mini progress bar */}
          <div
            className="mt-4 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--surface-2)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${next_target.percent_paid}%`,
                background: 'var(--accent-blue)',
              }}
            />
          </div>
          <p
            className="text-xs mt-1 text-right"
            style={{ color: 'var(--text-secondary)' }}
          >
            {next_target.percent_paid.toFixed(1)}% paid
          </p>
        </div>
      )}

      {/* Snowball order — all loans */}
      {summary.ordered_loans.length > 2 && (
        <div className="rounded-2xl p-5 glass">
          <p
            className="text-xs tracking-widest uppercase font-medium mb-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            Payoff Queue
          </p>
          <div className="flex flex-col gap-3">
            {summary.ordered_loans.slice(2).map((loan, i) => (
              <div key={loan.id} className="flex items-center gap-3">
                <span
                  className="text-xs w-5 text-center"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {i + 3}
                </span>
                <div
                  className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${loan.percent_paid}%`,
                      background: 'var(--border)',
                    }}
                  />
                </div>
                <span
                  className="text-sm min-w-25"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {loan.name}
                </span>
                <span
                  className="font-serif text-sm min-w-20 text-right"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {formatCurrency(loan.current_balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total progress bar — pinned to bottom feel */}
      <TotalProgressBar summary={summary} />
    </div>
  );
}
