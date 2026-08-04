'use client'

import { useState } from 'react'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import { useFamily } from '@/hooks/useFamily'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import { AppTextField } from '@/components/ui/AppTextField'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { formatCurrency } from '@/lib/snowball'
import type { SnowballStrategy } from '@/types'

export default function SettingsPage() {
  const { user } = useSupabase()
  const { family, settings, isAdmin, loading, updateStrategy, updateExtraBudget } = useFamily()
  const [extraBudget, setExtraBudget] = useState(String(settings?.extra_monthly_budget ?? 0))
  const [saved, setSaved] = useState(false)

  const handleStrategyChange = async (strategy: SnowballStrategy) => {
    await updateStrategy(strategy)
    flash()
  }

  const handleBudgetSave = async () => {
    await updateExtraBudget(Number(extraBudget) || 0)
    flash()
  }

  const flash = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Configure your debt payoff strategy
        </p>
      </div>

      {saved && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(16,212,126,0.1)', border: '1px solid rgba(16,212,126,0.3)', color: 'var(--accent-green)' }}>
          ✓ Settings saved
        </div>
      )}

      {/* Account */}
      <Section title="Account">
        <div className="flex items-center gap-3">
          {user?.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url} alt="" className="w-10 h-10 rounded-full" />
          )}
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {user?.user_metadata?.full_name ?? user?.email}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{user?.email}</p>
          </div>
        </div>
      </Section>

      {/* Payoff strategy — only if in a family and admin */}
      {family && isAdmin && settings && (
        <>
          <Section title="Payoff Strategy">
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Choose how your loans are ordered for payoff.
            </p>
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
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Any extra money beyond minimum payments that goes toward your current target loan.
            </p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <AppTextField
                  type="number"
                  value={extraBudget}
                  onChange={e => setExtraBudget(e.target.value)}
                  inputProps={{ min: 0, step: '50' }}
                  startAdornment={<InputAdornment position="start">$</InputAdornment>}
                />
              </div>
              <PrimaryButton
                onClick={handleBudgetSave}
                sx={{ px: 2.5 }}
              >
                Save
              </PrimaryButton>
            </div>
            {Number(extraBudget) > 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                {formatCurrency(Number(extraBudget))}/mo extra applied to current target
              </p>
            )}
          </Section>
        </>
      )}

      {/* No family */}
      {!family && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Strategy settings are managed at the family group level. Create or join a family group to configure them.
          </p>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 glass flex flex-col gap-3">
      <p className="text-xs tracking-widest uppercase font-medium" style={{ color: 'var(--text-secondary)' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function StrategyOption({
  active, onClick, title, description, emoji
}: {
  active: boolean; onClick: () => void; title: string; description: string; emoji: string
}) {
  return (
    <Button
      onClick={onClick}
      color="inherit"
      fullWidth
      sx={{
        alignItems: 'flex-start',
        display: 'flex',
        gap: 1.5,
        justifyContent: 'flex-start',
        p: 2,
        textAlign: 'left',
        background: active ? 'rgba(16,212,126,0.08)' : 'var(--surface)',
        border: `1px solid ${active ? 'rgba(16,212,126,0.4)' : 'var(--border)'}`,
        '&:hover': {
          background: active ? 'rgba(16,212,126,0.1)' : 'var(--surface)',
        },
      }}
    >
      <span className="text-xl flex-shrink-0">{emoji}</span>
      <div>
        <p className="text-sm font-medium" style={{ color: active ? 'var(--accent-green)' : 'var(--text-primary)' }}>
          {title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      </div>
      {active && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" className="ml-auto flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-green)' }}>
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      )}
    </Button>
  )
}
