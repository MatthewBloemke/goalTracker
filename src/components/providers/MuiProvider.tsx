'use client';

import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { DM_Sans } from 'next/font/google';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

const appColors = {
  background: '#0c0e14',
  surface: '#13161f',
  surface2: '#1c2030',
  border: '#252a3d',
  textPrimary: '#eef0ff',
  textSecondary: '#7880a0',
  accentGreen: '#0fd67c',
  accentGreenDim: '#0a8a52',
  accentGreenGlow: 'rgba(15,214,124,0.15)',
  accentAmber: '#f5a623',
  accentRed: '#f04444',
  accentBlue: '#5b5ff5',
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: appColors.accentGreen,
      dark: appColors.accentGreenDim,
      light: '#34d399',
      contrastText: '#000000',
    },
    secondary: {
      main: appColors.accentBlue,
      contrastText: '#ffffff',
    },
    error: {
      main: appColors.accentRed,
    },
    warning: {
      main: appColors.accentAmber,
    },
    background: {
      default: appColors.background,
      paper: appColors.surface,
    },
    text: {
      primary: appColors.textPrimary,
      secondary: appColors.textSecondary,
    },
    divider: appColors.border,
  },
  typography: {
    fontFamily: dmSans.style.fontFamily,
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          '--background': appColors.background,
          '--surface': appColors.surface,
          '--surface-2': appColors.surface2,
          '--border': appColors.border,
          '--text-primary': appColors.textPrimary,
          '--text-secondary': appColors.textSecondary,
          '--accent-green': appColors.accentGreen,
          '--accent-green-dim': appColors.accentGreenDim,
          '--accent-green-glow': appColors.accentGreenGlow,
          '--accent-amber': appColors.accentAmber,
          '--accent-red': appColors.accentRed,
          '--accent-blue': appColors.accentBlue,
        },
        body: {
          backgroundColor: appColors.background,
          color: appColors.textPrimary,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.9375rem',
          letterSpacing: 0,
          padding: '12px 24px',
          borderRadius: '8px',
          transition: 'all 0.15s ease',
          '&:hover': { transform: 'scale(1.02)' },
          '&:active': { transform: 'scale(0.98)' },
          variants: [
            {
              props: { variant: 'contained', color: 'primary' },
              style: {
                background: `linear-gradient(135deg, ${appColors.accentGreenDim}, ${appColors.accentGreen})`,
                color: 'white',
                boxShadow: '0 4px 20px rgba(15,214,124,0.25)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0b9e5e, #1ae889)',
                  boxShadow: '0 6px 28px rgba(15,214,124,0.35)',
                },
              },
            },
            {
              props: { variant: 'outlined', color: 'primary' },
              style: {
                borderColor: 'rgba(15,214,124,0.4)',
                color: appColors.accentGreen,
                '&:hover': {
                  borderColor: appColors.accentGreen,
                  background: 'rgba(15,214,124,0.06)',
                },
              },
            },
            {
              props: { variant: 'outlined', color: 'inherit' },
              style: {
                borderColor: appColors.border,
                color: appColors.textSecondary,
                '&:hover': {
                  borderColor: '#3a4060',
                  background: 'rgba(255,255,255,0.03)',
                },
              },
            },
          ],
        },
      },
    },
    MuiOutlinedInput: {
      defaultProps: {
        fullWidth: true,
      },
      styleOverrides: {
        root: {
          borderRadius: '8px',
          background: appColors.background,
          '& fieldset': {
            borderColor: appColors.border,
          },
          '&:hover fieldset': {
            borderColor: '#3a4060',
          },
          '&.Mui-focused fieldset': {
            borderColor: appColors.accentGreen,
            borderWidth: '1px',
          },
          '& .MuiInputBase-input': {
            color: appColors.textPrimary,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'rgba(19, 22, 31, 0.85)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${appColors.border}`,
          borderRadius: '8px',
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: appColors.surface,
          border: `1px solid ${appColors.border}`,
          borderRadius: '8px',
          boxShadow: 'none',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: appColors.border,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: appColors.surface2,
          border: `1px solid ${appColors.border}`,
          fontSize: '12px',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          background: appColors.surface2,
        },
        bar: {
          borderRadius: '4px',
          background: `linear-gradient(90deg, ${appColors.accentGreenDim}, ${appColors.accentGreen})`,
        },
      },
    },
  },
});

export function MuiProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
