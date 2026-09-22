'use client'

import Avatar from '@mui/material/Avatar'
import ButtonBase from '@mui/material/ButtonBase'
import { usePortalTheme } from '@/components/providers/MuiProvider'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import { portalThemes, type PortalThemePreset } from '@/lib/portal-themes'

export default function PortalSettingsPage() {
  const { user } = useSupabase()
  const { themeId, setThemeId, themeSaveState } = usePortalTheme()
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Family member'

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-green)]">Family Portal</p>
        <h1 className="mt-2 font-serif text-3xl text-[var(--text-primary)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Manage your account and personal portal preferences</p>
      </div>

      <Section title="Account">
        <div className="flex items-center gap-3">
          <Avatar src={user?.user_metadata?.avatar_url} alt={displayName} sx={{ width: 44, height: 44 }}>
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{displayName}</p>
            <p className="truncate text-xs text-[var(--text-secondary)]">{user?.email}</p>
          </div>
        </div>
      </Section>

      <Section title="Appearance">
        <p className="mb-1 text-sm text-[var(--text-secondary)]">
          Choose a preset for the entire Family Portal. Your selection follows your profile across devices.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {portalThemes.map((theme) => (
            <ThemeOption
              key={theme.id}
              theme={theme}
              active={theme.id === themeId}
              onClick={() => void setThemeId(theme.id)}
            />
          ))}
        </div>
        <ThemeSaveMessage state={themeSaveState} />
      </Section>
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

function ThemeSaveMessage({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  const messages = {
    idle: 'Theme changes apply immediately.',
    saving: 'Saving theme to your profile…',
    saved: 'Theme saved to your profile.',
    error: 'The theme changed locally, but could not be saved to your profile.',
  }

  return (
    <p className="text-xs" role={state === 'error' ? 'alert' : 'status'} style={{ color: state === 'error' ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
      {messages[state]}
    </p>
  )
}

function ThemeOption({ theme, active, onClick }: { theme: PortalThemePreset; active: boolean; onClick: () => void }) {
  const colors = theme.colors

  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={active}
      sx={{
        background: colors.surface,
        border: '1px solid',
        borderColor: active ? colors.accent : colors.border,
        borderRadius: '0.75rem',
        boxShadow: active ? `0 0 0 2px ${colors.accentGlow}` : 'none',
        display: 'block',
        p: 1.5,
        textAlign: 'left',
        transition: 'transform 150ms ease',
        width: '100%',
        '&:hover': { transform: 'translateY(-2px)' },
      }}
    >
      <span className="mb-3 flex h-9 overflow-hidden rounded-lg border" style={{ borderColor: colors.border }}>
        <span className="flex-1" style={{ background: colors.background }} />
        <span className="flex-1" style={{ background: colors.surface2 }} />
        <span className="flex-1" style={{ background: colors.accent }} />
      </span>
      <span className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold" style={{ color: colors.textPrimary }}>{theme.name}</span>
          <span className="mt-0.5 block text-xs leading-5" style={{ color: colors.textSecondary }}>{theme.description}</span>
        </span>
        {active && (
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs" style={{ background: colors.accent, color: colors.background }} aria-label="Selected">✓</span>
        )}
      </span>
    </ButtonBase>
  )
}
