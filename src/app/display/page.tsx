'use client'

import { useEffect, useRef, useState } from 'react'
import { useFamily } from '@/hooks/useFamily'
import { useLoans } from '@/hooks/useLoans'
import { formatCurrency, formatMonthsRemaining } from '@/lib/snowball'
import type { LoanWithProjection, SnowballSummary } from '@/types'
import Link from 'next/link'
import dayjs from 'dayjs'

export default function DisplayPage() {
  const { family, settings } = useFamily()
  const { summary, loading } = useLoans({
    familyId: family?.id,
    strategy: settings?.strategy ?? 'snowball',
    extraMonthlyBudget: settings?.extra_monthly_budget ?? 0,
  })
  const [time, setTime] = useState(new Date())

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <DisplayLoader />
  if (!summary || summary.ordered_loans.length === 0) return <DisplayEmpty />

  const { current_target, next_target } = summary

  return (
    <div className="display-root" style={{
      width: '1080px',
      minHeight: '1920px',
      background: 'var(--background)',
      display: 'flex',
      flexDirection: 'column',
      padding: '60px 64px',
      gap: '48px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 800px 600px at 50% 30%, rgba(16,212,126,0.06) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 600px 400px at 80% 80%, rgba(99,102,241,0.05) 0%, transparent 70%)',
      }} />

      {/* Header: time + family name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-serif)', fontSize: '96px', lineHeight: 1,
            color: 'var(--text-primary)', letterSpacing: '-2px',
          }}>
            {time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '')}
          </p>
          <p style={{ fontSize: '22px', color: 'var(--text-secondary)', marginTop: '8px', letterSpacing: '0.02em' }}>
            {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {family?.name ?? 'Debt Tracker'}
          </p>
          <Link href="/" style={{
            fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.5,
            textDecoration: 'none', letterSpacing: '0.1em',
            padding: '6px 12px', border: '1px solid var(--border)',
            borderRadius: '8px', display: 'inline-block',
          }}>
            Dashboard →
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--border)', opacity: 0.5 }} />

      {/* Main thermometer section */}
      {current_target && (
        <DisplayThermometer loan={current_target} />
      )}

      {/* Next up */}
      {next_target && (
        <DisplayNextUp loan={next_target} />
      )}

      {/* Queue — remaining loans */}
      {summary.ordered_loans.length > 2 && (
        <DisplayQueue loans={summary.ordered_loans.slice(2)} />
      )}

      {/* Total progress */}
      <DisplayTotalProgress summary={summary} />

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: '24px', borderTop: '1px solid var(--border)', opacity: 0.4,
      }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          DEBT SNOWBALL
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Updates in real time
        </p>
      </div>
    </div>
  )
}

// ── Large thermometer ──────────────────────────────────────────────────────

function DisplayThermometer({ loan }: { loan: LoanWithProjection }) {
  const [fill, setFill] = useState(0)
  const target = loan.percent_paid
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const duration = 1600
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setFill(target * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [loan.id, target])

  // SVG geometry — tall for portrait display
  const W = 160, H = 720
  const cx = W / 2
  const tw = 40           // tube width
  const bulbR = 44
  const bulbCY = H - bulbR - 6
  const tubeTop = 48
  const tubeBottom = bulbCY - bulbR + 10
  const tubeH = tubeBottom - tubeTop
  const fillH = (fill / 100) * tubeH
  const fillY = tubeBottom - fillH
  const ticks = [0, 25, 50, 75, 100]

  return (
    <div style={{ display: 'flex', gap: '64px', alignItems: 'center' }}>
      {/* Thermometer SVG */}
      <div style={{ flexShrink: 0 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <linearGradient id="df" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#10d47e"/>
              <stop offset="50%" stopColor="#34d399"/>
              <stop offset="100%" stopColor="#6ee7b7"/>
            </linearGradient>
            <linearGradient id="ds" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.06)"/>
              <stop offset="40%" stopColor="rgba(255,255,255,0.15)"/>
              <stop offset="100%" stopColor="rgba(255,255,255,0.02)"/>
            </linearGradient>
            <filter id="dg">
              <feGaussianBlur stdDeviation="4" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <clipPath id="dc">
              <rect x={cx - tw/2} y={tubeTop} width={tw} height={tubeH} rx={tw/2}/>
            </clipPath>
          </defs>

          {/* Tube bg */}
          <rect x={cx-tw/2} y={tubeTop} width={tw} height={tubeH} rx={tw/2}
            fill="rgba(30,35,55,0.9)" stroke="var(--border)" strokeWidth="1.5"/>

          {/* Fill */}
          <rect x={cx-tw/2} y={fillY} width={tw} height={fillH}
            clipPath="url(#dc)" fill="url(#df)" filter="url(#dg)"/>

          {/* Sheen */}
          <rect x={cx-tw/2} y={tubeTop} width={tw} height={tubeH} rx={tw/2}
            fill="url(#ds)"/>

          {/* Ticks */}
          {ticks.map(pct => {
            const y = tubeBottom - (pct/100)*tubeH
            const active = pct <= fill
            return (
              <g key={pct}>
                <line x1={cx+tw/2+3} y1={y} x2={cx+tw/2+16} y2={y}
                  stroke={active ? 'var(--accent-green)' : 'var(--border)'} strokeWidth="2"/>
                <text x={cx+tw/2+22} y={y+5} fontSize="13" fill={active ? 'var(--accent-green)' : 'var(--text-secondary)'}>
                  {pct}%
                </text>
              </g>
            )
          })}

          {/* Bulb */}
          <circle cx={cx} cy={bulbCY} r={bulbR}
            fill="rgba(30,35,55,0.9)" stroke="var(--border)" strokeWidth="1.5"/>
          <circle cx={cx} cy={bulbCY} r={bulbR-5}
            fill={fill > 0 ? 'url(#df)' : 'rgba(30,35,55,0.5)'}
            filter={fill > 0 ? 'url(#dg)' : undefined}/>
          <circle cx={cx-10} cy={bulbCY-10} r={10} fill="rgba(255,255,255,0.1)"/>
          <text x={cx} y={bulbCY+6} textAnchor="middle" fontSize="14" fontWeight="700" fill="white">
            {Math.round(fill)}%
          </text>
        </svg>
      </div>

      {/* Stats */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '36px' }}>
        <div>
          <p style={{ fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-green)', marginBottom: '12px' }}>
            Current Target
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '52px', lineHeight: 1.1, color: 'var(--text-primary)' }}>
            {loan.name}
          </p>
          {loan.lender && (
            <p style={{ fontSize: '20px', color: 'var(--text-secondary)', marginTop: '6px' }}>{loan.lender}</p>
          )}
        </div>

        <DisplayStat label="Remaining" value={formatCurrency(loan.current_balance)} large highlight />
        <DisplayStat label="Original Amount" value={formatCurrency(loan.original_amount)} />
        <DisplayStat label="Paid Off" value={formatCurrency(loan.original_amount - loan.current_balance)} positive />

        <div style={{ height: '1px', background: 'var(--border)', opacity: 0.4 }} />

        <DisplayStat label="Monthly Payment" value={formatCurrency(loan.min_payment)} />
        <DisplayStat label="Time Remaining" value={formatMonthsRemaining(loan.months_remaining)} />
        <DisplayStat label="Payoff Date"
          value={loan.months_remaining === Infinity ? '—' : dayjs(loan.payoff_date).format('MMMM YYYY')} />
      </div>
    </div>
  )
}

// ── Next up card ───────────────────────────────────────────────────────────

function DisplayNextUp({ loan }: { loan: LoanWithProjection }) {
  return (
    <div style={{
      borderRadius: '20px', padding: '32px 36px',
      background: 'rgba(26,29,39,0.8)', border: '1px solid var(--border)',
    }}>
      <p style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Up Next
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '32px' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '34px', color: 'var(--text-primary)' }}>{loan.name}</p>
          {loan.lender && <p style={{ fontSize: '17px', color: 'var(--text-secondary)', marginTop: '4px' }}>{loan.lender}</p>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', color: 'var(--text-primary)' }}>
            {formatCurrency(loan.current_balance)}
          </p>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {formatMonthsRemaining(loan.months_remaining)} remaining
          </p>
        </div>
      </div>
      {/* Mini bar */}
      <div style={{ marginTop: '20px', height: '6px', borderRadius: '3px', background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${loan.percent_paid}%`, borderRadius: '3px',
          background: 'var(--accent-blue)',
          boxShadow: '0 0 8px rgba(99,102,241,0.4)',
        }} />
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'right' }}>
        {loan.percent_paid.toFixed(1)}% paid
      </p>
    </div>
  )
}

// ── Queue ──────────────────────────────────────────────────────────────────

function DisplayQueue({ loans }: { loans: LoanWithProjection[] }) {
  return (
    <div style={{
      borderRadius: '20px', padding: '32px 36px',
      background: 'rgba(26,29,39,0.8)', border: '1px solid var(--border)',
    }}>
      <p style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '20px' }}>
        Payoff Queue
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loans.map((loan, i) => (
          <div key={loan.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', width: '24px', textAlign: 'center' }}>
              {i + 3}
            </span>
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${loan.percent_paid}%`, borderRadius: '3px', background: 'var(--border)' }} />
            </div>
            <span style={{ fontSize: '16px', color: 'var(--text-secondary)', minWidth: '120px' }}>{loan.name}</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-primary)', minWidth: '100px', textAlign: 'right' }}>
              {formatCurrency(loan.current_balance)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Total progress ─────────────────────────────────────────────────────────

function DisplayTotalProgress({ summary }: { summary: SnowballSummary }) {
  const [fill, setFill] = useState(0)
  const target = summary.percent_complete
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1400, 1)
      setFill(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target])

  const debtFreeText = summary.debt_free_date
    ? dayjs(summary.debt_free_date).format('MMMM YYYY')
    : '—'

  return (
    <div style={{
      borderRadius: '20px', padding: '36px',
      background: 'rgba(26,29,39,0.8)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <p style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Total Progress
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '44px', color: 'var(--accent-green)', lineHeight: 1 }}>
            {formatCurrency(summary.total_paid)}
            <span style={{ fontSize: '20px', color: 'var(--text-secondary)', marginLeft: '12px', fontFamily: 'var(--font-sans)' }}>
              eliminated
            </span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Debt-Free</p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)' }}>{debtFreeText}</p>
        </div>
      </div>

      {/* Bar */}
      <div style={{ height: '16px', borderRadius: '8px', background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%', width: `${fill}%`, borderRadius: '8px',
          background: 'linear-gradient(90deg, var(--accent-green-dim), var(--accent-green), #6ee7b7)',
          boxShadow: '0 0 20px rgba(16,212,126,0.4)',
          transition: 'none',
        }} />
        {[25,50,75].map(p => (
          <div key={p} style={{
            position: 'absolute', top: 0, bottom: 0, left: `${p}%`, width: '1px',
            background: 'rgba(255,255,255,0.08)',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          {formatCurrency(summary.total_current)} remaining
        </p>
        <p style={{ fontSize: '14px', color: 'var(--accent-green)', fontWeight: 600 }}>
          {fill.toFixed(1)}% complete
        </p>
      </div>

      {/* Loan dots */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
        {summary.ordered_loans.map((loan, i) => (
          <div key={loan.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: loan.current_balance === 0
                ? 'var(--accent-green)'
                : i === 0 ? 'var(--accent-amber)' : 'var(--border)',
            }} />
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{loan.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stat block ─────────────────────────────────────────────────────────────

function DisplayStat({ label, value, large, highlight, positive }: {
  label: string; value: string; large?: boolean; highlight?: boolean; positive?: boolean
}) {
  const color = highlight ? 'var(--text-primary)' : positive ? 'var(--accent-green)' : 'var(--text-secondary)'
  return (
    <div>
      <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-secondary)', marginBottom: '4px' }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'var(--font-serif)',
        fontSize: large ? '48px' : '30px',
        lineHeight: 1.1, color,
      }}>
        {value}
      </p>
    </div>
  )
}

// ── Loading / empty ────────────────────────────────────────────────────────

function DisplayLoader() {
  return (
    <div style={{ width: '1080px', height: '1920px', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid var(--accent-green)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
    </div>
  )
}

function DisplayEmpty() {
  return (
    <div style={{ width: '1080px', height: '1920px', background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: '48px', color: 'var(--text-primary)' }}>No loans yet</p>
      <Link href="/" style={{ color: 'var(--accent-green)', fontSize: '18px' }}>Go to Dashboard →</Link>
    </div>
  )
}
