export type PortalThemeId = 'midnight' | 'daylight' | 'forest' | 'ocean' | 'sunset'

export interface PortalThemeColors {
  background: string
  surface: string
  surface2: string
  border: string
  textPrimary: string
  textSecondary: string
  accent: string
  accentDark: string
  accentGlow: string
  accentSoft: string
  amber: string
  red: string
  blue: string
  glass: string
}

export interface PortalThemePreset {
  id: PortalThemeId
  name: string
  description: string
  mode: 'dark' | 'light'
  colors: PortalThemeColors
}

export const DEFAULT_PORTAL_THEME: PortalThemeId = 'midnight'
export const PORTAL_THEME_STORAGE_KEY = 'family-portal:theme'

export const portalThemes: PortalThemePreset[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'The original deep, focused dark theme.',
    mode: 'dark',
    colors: {
      background: '#0c0e14', surface: '#13161f', surface2: '#1c2030', border: '#252a3d',
      textPrimary: '#eef0ff', textSecondary: '#8d96b8', accent: '#0fd67c', accentDark: '#0a8a52',
      accentGlow: 'rgba(15,214,124,0.15)', accentSoft: '#6ee7b7', amber: '#f5a623',
      red: '#f04444', blue: '#5b5ff5', glass: 'rgba(19,22,31,0.88)',
    },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    description: 'Bright, clean, and easy to read in sunny rooms.',
    mode: 'light',
    colors: {
      background: '#f4f7f5', surface: '#ffffff', surface2: '#e8efeb', border: '#d4ded8',
      textPrimary: '#17231c', textSecondary: '#647269', accent: '#087f4f', accentDark: '#05643e',
      accentGlow: 'rgba(8,127,79,0.13)', accentSoft: '#35ad7c', amber: '#b96800',
      red: '#c93636', blue: '#4b55c7', glass: 'rgba(255,255,255,0.9)',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Quiet evergreens with warm natural highlights.',
    mode: 'dark',
    colors: {
      background: '#0d1512', surface: '#14211b', surface2: '#1d3027', border: '#2b4437',
      textPrimary: '#edf7f0', textSecondary: '#91aa9a', accent: '#76c893', accentDark: '#40916c',
      accentGlow: 'rgba(118,200,147,0.16)', accentSoft: '#b7e4c7', amber: '#e9b949',
      red: '#e06c75', blue: '#70a1d7', glass: 'rgba(20,33,27,0.9)',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool navy surfaces with a crisp coastal accent.',
    mode: 'dark',
    colors: {
      background: '#08131d', surface: '#0e202e', surface2: '#173247', border: '#25485f',
      textPrimary: '#edf8ff', textSecondary: '#8eb0c5', accent: '#38bdf8', accentDark: '#0284c7',
      accentGlow: 'rgba(56,189,248,0.16)', accentSoft: '#7dd3fc', amber: '#f4b860',
      red: '#fb7185', blue: '#818cf8', glass: 'rgba(14,32,46,0.9)',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'A warm, relaxed palette inspired by golden hour.',
    mode: 'light',
    colors: {
      background: '#fff8f1', surface: '#fffdf9', surface2: '#f7e8dc', border: '#ead5c6',
      textPrimary: '#38251d', textSecondary: '#80685c', accent: '#c75b39', accentDark: '#9e3f26',
      accentGlow: 'rgba(199,91,57,0.14)', accentSoft: '#ed9b7e', amber: '#bf7613',
      red: '#c23b4a', blue: '#6b67b9', glass: 'rgba(255,253,249,0.91)',
    },
  },
]

export function isPortalThemeId(value: string | null): value is PortalThemeId {
  return portalThemes.some((theme) => theme.id === value)
}

export function getPortalTheme(themeId: PortalThemeId): PortalThemePreset {
  return portalThemes.find((theme) => theme.id === themeId) ?? portalThemes[0]
}
