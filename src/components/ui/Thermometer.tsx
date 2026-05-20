'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency, formatMonthsRemaining } from '@/lib/snowball';
import type { LoanWithProjection } from '@/types';
import dayjs from 'dayjs';

interface ThermometerProps {
  loan: LoanWithProjection;
  animate?: boolean;
}

export function Thermometer({ loan, animate = true }: ThermometerProps) {
  const targetPercent = Math.max(0, Math.min(100, loan.percent_paid));
  const [displayPercent, setDisplayPercent] = useState(
    animate ? 0 : targetPercent,
  );
  const animationRef = useRef<number | null>(null);

  // Animate fill on mount / loan change
  useEffect(() => {
    if (!animate) return;

    const start = performance.now();
    const duration = 1200;
    const from = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPercent(from + (targetPercent - from) * eased);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [loan.id, targetPercent, animate]);

  // SVG geometry
  const width = 120;
  const height = 480;
  const tubeX = width / 2;
  const tubeWidth = 28;
  const bulbR = 30;
  const bulbCY = height - bulbR - 4;
  const tubeTop = 40;
  const tubeBottom = bulbCY - bulbR + 8;
  const tubeHeight = tubeBottom - tubeTop;
  const fillHeight = (displayPercent / 100) * tubeHeight;
  const fillY = tubeBottom - fillHeight;

  // Tick marks
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Loan name */}
      <div className="text-center">
        <p
          className="text-xs font-medium tracking-widest uppercase"
          style={{ color: 'var(--accent-green)' }}
        >
          Current Target
        </p>
        <h2
          className="font-serif text-2xl mt-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {loan.name}
        </h2>
        {loan.lender && (
          <p
            className="text-sm mt-0.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            {loan.lender}
          </p>
        )}
      </div>

      <div className="flex items-center gap-8">
        {/* SVG Thermometer */}
        <div className="relative">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <defs>
              {/* Tube gradient */}
              <linearGradient id="fillGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#10d47e" />
                <stop offset="60%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#6ee7b7" />
              </linearGradient>
              {/* Glass sheen */}
              <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="40%" stopColor="rgba(255,255,255,0.18)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
              </linearGradient>
              {/* Glow filter */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Clip path for tube fill */}
              <clipPath id="tubeClip">
                <rect
                  x={tubeX - tubeWidth / 2}
                  y={tubeTop}
                  width={tubeWidth}
                  height={tubeHeight}
                  rx={tubeWidth / 2}
                />
              </clipPath>
            </defs>

            {/* Tube background */}
            <rect
              x={tubeX - tubeWidth / 2}
              y={tubeTop}
              width={tubeWidth}
              height={tubeHeight}
              rx={tubeWidth / 2}
              fill="rgba(30,35,55,0.9)"
              stroke="var(--border)"
              strokeWidth="1.5"
            />

            {/* Tube fill */}
            <rect
              x={tubeX - tubeWidth / 2}
              y={fillY}
              width={tubeWidth}
              height={fillHeight}
              clipPath="url(#tubeClip)"
              fill="url(#fillGradient)"
              filter="url(#glow)"
            />

            {/* Glass sheen overlay on tube */}
            <rect
              x={tubeX - tubeWidth / 2}
              y={tubeTop}
              width={tubeWidth}
              height={tubeHeight}
              rx={tubeWidth / 2}
              fill="url(#glassSheen)"
            />

            {/* Tick marks */}
            {ticks.map((pct) => {
              const y = tubeBottom - (pct / 100) * tubeHeight;
              const isFilled = pct <= displayPercent;
              return (
                <g key={pct}>
                  <line
                    x1={tubeX + tubeWidth / 2 + 2}
                    y1={y}
                    x2={tubeX + tubeWidth / 2 + 10}
                    y2={y}
                    stroke={isFilled ? 'var(--accent-green)' : 'var(--border)'}
                    strokeWidth="1.5"
                  />
                  <text
                    x={tubeX + tubeWidth / 2 + 14}
                    y={y + 4}
                    fontSize="9"
                    fill={
                      isFilled ? 'var(--accent-green)' : 'var(--text-secondary)'
                    }
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Bulb background */}
            <circle
              cx={tubeX}
              cy={bulbCY}
              r={bulbR}
              fill="rgba(30,35,55,0.9)"
              stroke="var(--border)"
              strokeWidth="1.5"
            />

            {/* Bulb fill — always full when any progress made */}
            <circle
              cx={tubeX}
              cy={bulbCY}
              r={bulbR - 4}
              fill={
                displayPercent > 0 ? 'url(#fillGradient)' : 'rgba(30,35,55,0.5)'
              }
              filter={displayPercent > 0 ? 'url(#glow)' : undefined}
            />

            {/* Bulb sheen */}
            <circle
              cx={tubeX - 8}
              cy={bulbCY - 8}
              r={8}
              fill="rgba(255,255,255,0.1)"
            />

            {/* Percent label inside bulb */}
            <text
              x={tubeX}
              y={bulbCY + 5}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="white"
            >
              {Math.round(displayPercent)}%
            </text>
          </svg>
        </div>

        {/* Stats panel */}
        <div className="flex flex-col gap-5 min-w-[160px]">
          <StatBlock
            label="Remaining"
            value={formatCurrency(loan.current_balance)}
            highlight
          />
          <StatBlock
            label="Original"
            value={formatCurrency(loan.original_amount)}
          />
          <StatBlock
            label="Paid Off"
            value={formatCurrency(loan.original_amount - loan.current_balance)}
            positive
          />
          <div className="h-px" style={{ background: 'var(--border)' }} />
          <StatBlock
            label="Min Payment"
            value={formatCurrency(loan.min_payment)}
          />
          <StatBlock
            label="Time Left"
            value={formatMonthsRemaining(loan.months_remaining)}
          />
          <StatBlock
            label="Payoff Date"
            value={
              loan.months_remaining === Infinity
                ? '—'
                : dayjs(loan.payoff_date).format('MMM YYYY')
            }
          />
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  highlight,
  positive,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  const color = highlight
    ? 'var(--text-primary)'
    : positive
      ? 'var(--accent-green)'
      : 'var(--text-secondary)';

  return (
    <div>
      <p
        className="text-xs tracking-wider uppercase mb-0.5"
        style={{ color: 'var(--text-secondary)', fontSize: '10px' }}
      >
        {label}
      </p>
      <p className="font-serif text-xl leading-tight" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
