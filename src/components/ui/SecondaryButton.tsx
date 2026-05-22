'use client'

import MuiButton, { ButtonProps as MuiButtonProps } from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

interface SecondaryButtonProps extends Omit<MuiButtonProps, 'variant' | 'color'> {
  loading?: boolean
}

export function SecondaryButton({ loading, disabled, children, sx, ...props }: SecondaryButtonProps) {
  return (
    <MuiButton
      variant="outlined"
      color="inherit"
      disabled={disabled || loading}
      sx={{
        minWidth: 80,
        ...sx,
      }}
      {...props}
    >
      {loading ? (
        <CircularProgress size={18} sx={{ color: 'inherit' }} />
      ) : (
        children
      )}
    </MuiButton>
  )
}
