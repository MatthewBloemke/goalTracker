'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import {
  DEFAULT_PORTAL_THEME,
  getPortalTheme,
  isPortalThemeId,
  PORTAL_THEME_STORAGE_KEY,
  portalThemes,
  type PortalThemeId,
} from '@/lib/portal-themes'

interface PortalThemeContextValue {
  themeId: PortalThemeId
  setThemeId: (themeId: PortalThemeId) => Promise<void>
  themeSaveState: 'idle' | 'saving' | 'saved' | 'error'
}

const PortalThemeContext = createContext<PortalThemeContextValue | null>(null)

export function usePortalTheme() {
  const context = useContext(PortalThemeContext)
  if (!context) throw new Error('usePortalTheme must be used inside MuiProvider')
  return context
}

export function MuiProvider({ children }: { children: React.ReactNode }) {
  const { supabase, user, loading: authLoading } = useSupabase()
  const [themeId, setThemeIdState] = useState<PortalThemeId>(DEFAULT_PORTAL_THEME)
  const [themeSaveState, setThemeSaveState] = useState<PortalThemeContextValue['themeSaveState']>('idle')
  const hasLocalSelection = useRef(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem(PORTAL_THEME_STORAGE_KEY)
      if (isPortalThemeId(savedTheme)) setThemeIdState(savedTheme)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (authLoading || !user) return

    let cancelled = false
    hasLocalSelection.current = false

    const loadProfileTheme = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('theme_preference')
        .eq('user_id', user.id)
        .maybeSingle()
      const profileTheme = data?.theme_preference ?? null

      if (
        !cancelled
        && !hasLocalSelection.current
        && isPortalThemeId(profileTheme)
      ) {
        setThemeIdState(profileTheme)
        window.localStorage.setItem(PORTAL_THEME_STORAGE_KEY, profileTheme)
      }
    }

    void loadProfileTheme()
    return () => { cancelled = true }
  }, [authLoading, supabase, user])

  const setThemeId = useCallback(async (nextThemeId: PortalThemeId) => {
    hasLocalSelection.current = true
    setThemeIdState(nextThemeId)
    window.localStorage.setItem(PORTAL_THEME_STORAGE_KEY, nextThemeId)

    if (!user) return

    setThemeSaveState('saving')
    const { error } = await supabase
      .from('profiles')
      .update({ theme_preference: nextThemeId })
      .eq('user_id', user.id)

    setThemeSaveState(error ? 'error' : 'saved')
  }, [supabase, user])

  const preset = getPortalTheme(themeId)
  const theme = useMemo(() => createPortalMuiTheme(preset), [preset])

  useEffect(() => {
    document.documentElement.dataset.portalTheme = themeId
    document.documentElement.style.colorScheme = preset.mode
  }, [preset.mode, themeId])

  const contextValue = useMemo(
    () => ({ themeId, setThemeId, themeSaveState }),
    [setThemeId, themeId, themeSaveState],
  )

  return (
    <AppRouterCacheProvider>
      <PortalThemeContext.Provider value={contextValue}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </PortalThemeContext.Provider>
    </AppRouterCacheProvider>
  )
}

function createPortalMuiTheme(preset: (typeof portalThemes)[number]) {
  const colors = preset.colors

  return createTheme({
    palette: {
      mode: preset.mode,
      primary: { main: colors.accent, dark: colors.accentDark, light: colors.accentSoft },
      secondary: { main: colors.blue },
      error: { main: colors.red },
      warning: { main: colors.amber },
      background: { default: colors.background, paper: colors.surface },
      text: { primary: colors.textPrimary, secondary: colors.textSecondary },
      divider: colors.border,
    },
    typography: {
      fontFamily: 'var(--font-sans), sans-serif',
      button: { textTransform: 'none', fontWeight: 500 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--background': colors.background,
            '--surface': colors.surface,
            '--surface-2': colors.surface2,
            '--border': colors.border,
            '--text-primary': colors.textPrimary,
            '--text-secondary': colors.textSecondary,
            '--accent-green': colors.accent,
            '--accent-green-dim': colors.accentDark,
            '--accent-green-glow': colors.accentGlow,
            '--accent-green-soft': colors.accentSoft,
            '--accent-amber': colors.amber,
            '--accent-red': colors.red,
            '--accent-blue': colors.blue,
            '--glass': colors.glass,
          },
          body: {
            backgroundColor: colors.background,
            color: colors.textPrimary,
            transition: 'background-color 180ms ease, color 180ms ease',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none', fontWeight: 500, fontSize: '0.9375rem', letterSpacing: 0,
            padding: '12px 24px', borderRadius: '8px', transition: 'all 0.15s ease',
            '&:hover': { transform: 'scale(1.02)' },
            '&:active': { transform: 'scale(0.98)' },
          },
        },
        variants: [
          {
            props: { variant: 'contained', color: 'primary' },
            style: {
              background: `linear-gradient(135deg, ${colors.accentDark}, ${colors.accent})`,
              color: preset.mode === 'light' ? '#ffffff' : colors.background,
              boxShadow: `0 4px 20px ${colors.accentGlow}`,
            },
          },
          {
            props: { variant: 'outlined', color: 'primary' },
            style: { borderColor: colors.accent, color: colors.accent },
          },
        ],
      },
      MuiOutlinedInput: {
        defaultProps: { fullWidth: true },
        styleOverrides: {
          root: {
            borderRadius: '8px', background: colors.background,
            '& fieldset': { borderColor: colors.border },
            '&:hover fieldset': { borderColor: colors.textSecondary },
            '&.Mui-focused fieldset': { borderColor: colors.accent, borderWidth: '1px' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: colors.glass, backdropFilter: 'blur(16px)', border: `1px solid ${colors.border}`,
            borderRadius: '8px', boxShadow: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', boxShadow: 'none' },
        },
      },
      MuiDivider: { styleOverrides: { root: { borderColor: colors.border } } },
      MuiChip: { styleOverrides: { root: { borderRadius: '8px' } } },
      MuiTooltip: {
        styleOverrides: { tooltip: { background: colors.surface2, border: `1px solid ${colors.border}`, fontSize: '12px' } },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: '4px', background: colors.surface2 },
          bar: { borderRadius: '4px', background: `linear-gradient(90deg, ${colors.accentDark}, ${colors.accent})` },
        },
      },
    },
  })
}
