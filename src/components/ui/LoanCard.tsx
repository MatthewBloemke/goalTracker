'use client';

import { useState } from 'react';
import {
  formatCurrency,
  formatRate,
  formatMonthsRemaining,
} from '@/lib/snowball';
import { PaymentButtons } from './PaymentButton';
import { LoanForm } from './LoanForm';
import { PaymentHistory } from './PaymentHistory';
import type { LoanWithProjection } from '@/types';
import dayjs from 'dayjs';

interface LoanCardProps {
  loan: LoanWithProjection;
  position: number;
  isTarget: boolean;
  onUpdate: () => void;
}

type Tab = 'overview' | 'history';

export function LoanCard({
  loan,
  position,
  isTarget,
  onUpdate,
}: LoanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const percentPaid = loan.percent_paid;
  const isPaidOff = loan.current_balance === 0;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        border: isTarget
          ? '1px solid rgba(16,212,126,0.4)'
          : '1px solid var(--border)',
        background: isTarget ? 'rgba(16,212,126,0.04)' : 'var(--surface)',
        boxShadow: isTarget ? '0 0 24px rgba(16,212,126,0.08)' : 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => !editing && setExpanded((e) => !e)}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
          style={{
            background: isPaidOff
              ? 'rgba(16,212,126,0.15)'
              : isTarget
                ? 'rgba(16,212,126,0.2)'
                : 'var(--surface-2)',
            color:
              isPaidOff || isTarget
                ? 'var(--accent-green)'
                : 'var(--text-secondary)',
          }}
        >
          {isPaidOff ? '✓' : position}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {loan.name}
            </p>
            {isTarget && !isPaidOff && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(16,212,126,0.15)',
                  color: 'var(--accent-green)',
                }}
              >
                Target
              </span>
            )}
            {isPaidOff && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(16,212,126,0.15)',
                  color: 'var(--accent-green)',
                }}
              >
                Paid Off 🎉
              </span>
            )}
          </div>
          {loan.lender && (
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {loan.lender}
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p
            className="font-serif text-lg"
            style={{
              color: isPaidOff ? 'var(--accent-green)' : 'var(--text-primary)',
            }}
          >
            {formatCurrency(loan.current_balance)}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            {percentPaid.toFixed(1)}% paid
          </p>
        </div>

        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="shrink-0 transition-transform duration-200"
          style={{
            color: 'var(--text-secondary)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--surface-2)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${percentPaid}%`,
              background: isPaidOff
                ? 'var(--accent-green)'
                : isTarget
                  ? 'linear-gradient(90deg, var(--accent-green-dim), var(--accent-green))'
                  : 'var(--accent-blue)',
            }}
          />
        </div>
      </div>

      {/* Expanded */}
      {expanded && !editing && (
        <div
          className="border-t"
          style={{ borderColor: 'var(--border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tabs */}
          <div className="flex px-5 pt-4 gap-1">
            {(['overview', 'history'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
                style={{
                  background: tab === t ? 'var(--surface-2)' : 'transparent',
                  color:
                    tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border:
                    tab === t
                      ? '1px solid var(--border)'
                      : '1px solid transparent',
                }}
              >
                {t === 'history' ? 'Payment History' : 'Overview'}
              </button>
            ))}
          </div>

          <div className="px-5 pb-5 pt-4">
            {tab === 'overview' && (
              <div className="flex flex-col gap-5">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Stat
                    label="Original"
                    value={formatCurrency(loan.original_amount)}
                  />
                  <Stat
                    label="Interest Rate"
                    value={formatRate(loan.interest_rate)}
                  />
                  <Stat
                    label="Min Payment"
                    value={formatCurrency(loan.min_payment)}
                  />
                  <Stat
                    label="Time Left"
                    value={formatMonthsRemaining(loan.months_remaining)}
                  />
                  <Stat
                    label="Payoff Date"
                    value={
                      loan.months_remaining === Infinity
                        ? '—'
                        : dayjs(loan.payoff_date).format('MMM YYYY')
                    }
                  />
                  <Stat
                    label="Interest Left"
                    value={formatCurrency(loan.total_interest_remaining)}
                    dim
                  />
                </div>

                {!isPaidOff && (
                  <PaymentButtons loan={loan} onSuccess={onUpdate} />
                )}

                <button
                  onClick={() => setEditing(true)}
                  className="w-full py-2.5 rounded-xl text-sm transition-colors"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Edit Loan Details
                </button>
              </div>
            )}

            {tab === 'history' && <PaymentHistory loanId={loan.id} />}
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div
          className="px-5 pb-5 border-t pt-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <LoanForm
            loan={loan}
            onSuccess={() => {
              setEditing(false);
              setExpanded(false);
              onUpdate();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  dim,
}: {
  label: string;
  value: string;
  dim?: boolean;
}) {
  return (
    <div>
      <p
        className="text-xs mb-1 uppercase tracking-wider"
        style={{ color: 'var(--text-secondary)', fontSize: '10px' }}
      >
        {label}
      </p>
      <p
        className="text-sm font-medium"
        style={{ color: dim ? 'var(--text-secondary)' : 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}
