'use client'

import { useState } from 'react'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import { useFamily } from '@/hooks/useFamily'
import { AppTextField } from '@/components/ui/AppTextField'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { formatCurrency } from '@/app/budget/_lib/snowball'
import type { SnowballStrategy } from '@/types'

export default function BudgetSettingsPage() {
  const { family, settings, isAdmin, loading, updateStrategy, updateExtraBudget } = useFamily()
  const [extraBudget, setExtraBudget] = useState(String(settings?.extra_monthly_budget ?? 0))
  const [saved, setSaved] = useState(false)

  const flash = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleStrategyChange = async (strategy: SnowballStrategy) => {
    await updateStrategy(strategy)
    flash()
  }

  const handleBudgetSave = async () => {
    await updateExtraBudget(Number(extraBudget) || 0)
    flash()
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl text-[var(--text-primary)]">Budget Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Configure your family&apos;s debt payoff plan</p>
      </div>

      {saved && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)' }}>
          ✓ Budget settings saved
        </div>
      )}

      {family && isAdmin && settings && (
        <>
          <Section title="Payoff Strategy">
            <p className="mb-4 text-sm text-[var(--text-secondary)]">Choose how your loans are ordered for payoff.</p>
            <div className="flex flex-col gap-3">
              <StrategyOption
                active={settings.strategy === 'snowball'}
                onClick={() => handleStrategyChange('snowball')}
                title="Debt Snowball"
                description="Pay off smallest balances first. Builds momentum with quick wins."
                emoji="⛄"
              />
              <StrategyOption
                active={settings.strategy === 'avalanche'}
                onClick={() => handleStrategyChange('avalanche')}
                title="Debt Avalanche"
                description="Pay off highest interest rates first. Saves the most money overall."
                emoji="🏔️"
              />
            </div>
          </Section>

          <Section title="Extra Monthly Budget">
            <p className="mb-4 text-sm text-[var(--text-secondary)]">
              Any extra money beyond minimum payments that goes toward your current target loan.
            </p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <AppTextField
                  type="number"
                  value={extraBudget}
                  onChange={(event) => setExtraBudget(event.target.value)}
                  slotProps={{
                    htmlInput: { min: 0, step: '50' },
                    input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                  }}
                />
              </div>
              <PrimaryButton onClick={handleBudgetSave} sx={{ px: 2.5 }}>Save</PrimaryButton>
            </div>
            {Number(extraBudget) > 0 && (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {formatCurrency(Number(extraBudget))}/mo extra applied to current target
              </p>
            )}
          </Section>
        </>
      )}

      {!family && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm text-[var(--text-secondary)]">
            Strategy settings are managed at the family group level. Create or join a family group to configure them.
          </p>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass flex flex-col gap-3 rounded-2xl p-5">
      <h2 className="text-xs font-medium uppercase tracking-widest text-[var(--text-secondary)]">{title}</h2>
      {children}
    </section>
  )
}

function StrategyOption({
  active,
  onClick,
  title,
  description,
  emoji,
}: {
  active: boolean
  onClick: () => void
  title: string
  description: string
  emoji: string
}) {
  return (
    <Button
      onClick={onClick}
      color="inherit"
      fullWidth
      sx={{
        alignItems: 'flex-start', display: 'flex', gap: 1.5, justifyContent: 'flex-start',
        p: 2, textAlign: 'left', background: active ? 'var(--accent-green-glow)' : 'var(--surface)',
        border: `1px solid ${active ? 'var(--accent-green)' : 'var(--border)'}`,
        '&:hover': { background: active ? 'var(--accent-green-glow)' : 'var(--surface-2)' },
      }}
    >
      <span className="flex-shrink-0 text-xl">{emoji}</span>
      <div>
        <p className="text-sm font-medium" style={{ color: active ? 'var(--accent-green)' : 'var(--text-primary)' }}>{title}</p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{description}</p>
      </div>
      {active && <span className="ml-auto text-[var(--accent-green)]">✓</span>}
    </Button>
  )
}
