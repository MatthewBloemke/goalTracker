import {
  DEFAULT_PORTAL_THEME,
  getPortalTheme,
  isPortalThemeId,
  portalThemes,
} from './portal-themes'

describe('Family Portal themes', () => {
  test('provides several distinct presets including dark and light options', () => {
    expect(portalThemes.map(({ id }) => id)).toEqual([
      'midnight',
      'daylight',
      'forest',
      'ocean',
      'sunset',
    ])
    expect(portalThemes.some(({ mode }) => mode === 'dark')).toBe(true)
    expect(portalThemes.some(({ mode }) => mode === 'light')).toBe(true)
  })

  test('recognizes only registered theme identifiers', () => {
    expect(isPortalThemeId(DEFAULT_PORTAL_THEME)).toBe(true)
    expect(isPortalThemeId('ocean')).toBe(true)
    expect(isPortalThemeId('unknown')).toBe(false)
    expect(isPortalThemeId(null)).toBe(false)
  })

  test('resolves presets and safely falls back to the default', () => {
    expect(getPortalTheme('forest').name).toBe('Forest')
    expect(getPortalTheme('not-a-theme' as never).id).toBe(DEFAULT_PORTAL_THEME)
  })

  test('defines the full set of colors required by shared components', () => {
    for (const theme of portalThemes) {
      expect(theme.colors).toEqual(expect.objectContaining({
        accent: expect.any(String),
        background: expect.any(String),
        border: expect.any(String),
        glass: expect.any(String),
        surface: expect.any(String),
        surface2: expect.any(String),
        textPrimary: expect.any(String),
        textSecondary: expect.any(String),
      }))
    }
  })
})
