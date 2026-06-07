'use client';

import MuiButton, { ButtonProps as MuiButtonProps } from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

interface PrimaryButtonProps extends Omit<MuiButtonProps, 'variant' | 'color'> {
  loading?: boolean;
}

export function PrimaryButton({
  loading,
  disabled,
  children,
  sx,
  ...props
}: PrimaryButtonProps) {
  return (
    <MuiButton
      variant="contained"
      color="primary"
      disabled={disabled || loading}
      sx={{
        minWidth: 120,
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
  );
}
