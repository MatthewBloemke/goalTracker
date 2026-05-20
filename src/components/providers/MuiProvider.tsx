'use client';

import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { DM_Sans } from 'next/font/google';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0fd67c',
      dark: '#0a8a52',
      light: '#34d399',
      contrastText: '#000000',
    },
    secondary: {
      main: '#5b5ff5',
      contrastText: '#ffffff',
    },
    error: {
      main: '#f04444',
    },
    warning: {
      main: '#f5a623',
    },
    background: {
      default: '#0c0e14',
      paper: '#13161f',
    },
    text: {
      primary: '#eef0ff',
      secondary: '#7880a0',
    },
    divider: '#252a3d',
  },
  typography: {
    fontFamily: dmSans.style.fontFamily,
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0c0e14',
          color: '#eef0ff',
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
          letterSpacing: '0.01em',
          padding: '12px 24px',
          borderRadius: '12px',
          transition: 'all 0.15s ease',
          '&:hover': { transform: 'scale(1.02)' },
          '&:active': { transform: 'scale(0.98)' },
          variants: [
            {
              props: { variant: 'contained', color: 'primary' },
              style: {
                background: 'linear-gradient(135deg, #0a8a52, #0fd67c)',
                color: '#000',
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
                color: '#0fd67c',
                '&:hover': {
                  borderColor: '#0fd67c',
                  background: 'rgba(15,214,124,0.06)',
                },
              },
            },
            {
              props: { variant: 'outlined', color: 'inherit' },
              style: {
                borderColor: '#252a3d',
                color: '#7880a0',
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
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            background: '#0c0e14',
            '& fieldset': {
              borderColor: '#252a3d',
            },
            '&:hover fieldset': {
              borderColor: '#3a4060',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#0fd67c',
              borderWidth: '1px',
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#0fd67c',
          },
          '& .MuiInputBase-input': {
            color: '#eef0ff',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'rgba(19, 22, 31, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid #252a3d',
          borderRadius: '20px',
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: '#13161f',
          border: '1px solid #252a3d',
          borderRadius: '16px',
          boxShadow: 'none',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#252a3d',
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
          background: '#1c2030',
          border: '1px solid #252a3d',
          fontSize: '12px',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          background: '#1c2030',
        },
        bar: {
          borderRadius: '4px',
          background: 'linear-gradient(90deg, #0a8a52, #0fd67c)',
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
