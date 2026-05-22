'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCurrency, formatMonthsRemaining } from '@/lib/snowball'
import type { LoanWithProjection } from '@/types'
import dayjs from 'dayjs'
import Typography from '@mui/material/Typography'

interface ThermometerProps {
  loan: LoanWithProjection
  animate?: boolean
}

export function Thermometer({ loan, animate = true }: ThermometerProps) {
  const targetPercent = Math.max(0, Math.min(100, loan.percent_paid))
  const [displayPercent, setDisplayPercent] = useState(animate ? 0 : targetPercent)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!animate) return
    const start = performance.now()
    const duration = 1400
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayPercent(targetPercent * eased)
      if (progress < 1) animationRef.current = requestAnimationFrame(tick)
    }
    animationRef.current = requestAnimationFrame(tick)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [loan.id, targetPercent, animate])

  // SVG geometry
  const W = 180
  const H = 420
  const cx = 70
  const tubeW = 38
  const tubeR = tubeW / 2
  const tubeTop = 24
  const bulbR = 34
  const bulbCY = H - bulbR - 4
  // Tube bottom stops at bulb center — bulb drawn on top covers the join
  const tubeBottom = bulbCY
  const tubeH = tubeBottom - tubeTop
  const fillH = (displayPercent / 100) * tubeH
  const fillY = tubeBottom - fillH
  const ticks = [0, 25, 50, 75, 100]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <Typography style={{
          fontSize: '11px', fontWeight: 600, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: 'var(--accent-green)', marginBottom: '6px',
        }}>
          Current Target
        </Typography>
        <Typography style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          {loan.name}
        </Typography>
        {loan.lender && (
          <Typography style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '3px' }}>
            {loan.lender}
          </Typography>
        )}
      </div>

      {/* Thermometer + stats side by side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>

        {/* SVG */}
        <svg width={W} height={H + bulbR} viewBox={`0 0 ${W} ${H + bulbR}`} style={{ flexShrink: 0, overflow: 'visible' }}>
          <defs>
            <linearGradient id="tubeGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#0fd67c" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
            <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="30%" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-10%" width="200%" height="120%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>

          </defs>

          {/* 1. Tube shell */}
          <rect
            x={cx - tubeR} y={tubeTop}
            width={tubeW} height={tubeH}
            rx={tubeR}
            fill="rgba(20,24,38,0.95)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
          />

          {/* 2. Tube fill */}
          {fillH > 0 && (
            <rect
              x={cx - tubeR} y={fillY}
              width={tubeW} height={fillH}
              rx={fillY <= tubeTop + tubeR ? tubeR : 0}
              fill="url(#tubeGrad)"
              filter="url(#glow)"
            />
          )}

          {/* 3. Tube glass sheen */}
          <rect
            x={cx - tubeR} y={tubeTop}
            width={tubeW} height={tubeH}
            rx={tubeR}
            fill="url(#sheen)"
            style={{ pointerEvents: 'none' }}
          />

          {/* 4. Cover rect — hides the bottom rounded cap of the tube
                 so the bulb appears to grow out of a flat bottom */}
          <rect
            x={cx - tubeR} y={bulbCY - tubeR}
            width={tubeW} height={tubeR + 2}
            fill="rgba(20,24,38,0.95)"
          />
          {/* Cover any fill that peeked into the cap area */}
          {fillH > 0 && displayPercent > 2 && (
            <rect
              x={cx - tubeR} y={bulbCY - tubeR}
              width={tubeW} height={tubeR + 2}
              fill="url(#tubeGrad)"
            />
          )}

          {/* 5. Bulb shell — drawn on top of everything */}
          <circle
            cx={cx} cy={bulbCY} r={bulbR}
            fill="rgba(20,24,38,0.95)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
          />

          {/* 6. Bulb fill */}
          <circle
            cx={cx} cy={bulbCY} r={bulbR - 2}
            fill={displayPercent > 0 ? 'url(#tubeGrad)' : 'rgba(30,36,56,0.8)'}
            filter={displayPercent > 0 ? 'url(#glow)' : undefined}
          />

          {/* 7. Bulb sheen */}
          <circle cx={cx - 9} cy={bulbCY - 10} r={8} fill="rgba(255,255,255,0.07)" />

          {/* 8. Percent label */}
          <text
            x={cx} y={bulbCY + 6}
            textAnchor="middle"
            fontSize="13" fontWeight="700"
            fontFamily="inherit"
            fill="white"
          >
            {Math.round(displayPercent)}%
          </text>

          {/* ── Tick marks (right side of tube) ── */}
          {ticks.map(pct => {
            const y = tubeBottom - (pct / 100) * tubeH
            const active = pct <= displayPercent
            const isMajor = pct === 0 || pct === 50 || pct === 100
            return (
              <g key={pct}>
                <line
                  x1={cx + tubeW/2 + 4} y1={y}
                  x2={cx + tubeW/2 + (isMajor ? 14 : 10)} y2={y}
                  stroke={active ? 'var(--accent-green)' : 'rgba(255,255,255,0.15)'}
                  strokeWidth={isMajor ? 1.5 : 1}
                />
                <text
                  x={cx + tubeW/2 + 18} y={y + 4}
                  fontSize="11"
                  fontFamily="inherit"
                  fill={active ? 'var(--accent-green)' : 'rgba(255,255,255,0.3)'}
                >
                  {pct}%
                </text>
              </g>
            )
          })}
        </svg>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '150px' }}>
          <StatBlock label="Remaining" value={formatCurrency(loan.current_balance)} highlight />
          <StatBlock label="Original" value={formatCurrency(loan.original_amount)} />
          <StatBlock label="Paid Off" value={formatCurrency(loan.original_amount - loan.current_balance)} positive />
          <div style={{ height: '1px', background: 'var(--border)' }} />
          <StatBlock label="Min Payment" value={formatCurrency(loan.min_payment)} />
          <StatBlock label="Time Left" value={formatMonthsRemaining(loan.months_remaining)} />
          <StatBlock
            label="Payoff Date"
            value={loan.months_remaining === Infinity ? '—' : dayjs(loan.payoff_date).format('MMM YYYY')}
          />
        </div>
      </div>
    </div>
  )
}

function StatBlock({ label, value, highlight, positive }: {
  label: string; value: string; highlight?: boolean; positive?: boolean
}) {
  const color = highlight
    ? 'var(--text-primary)'
    : positive
    ? 'var(--accent-green)'
    : 'var(--text-secondary)'

  return (
    <div>
      <Typography style={{
        fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '3px',
      }}>
        {label}
      </Typography>
      <Typography style={{ fontSize: '20px', fontWeight: 600, color, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
        {value}
      </Typography>
    </div>
  )
}
