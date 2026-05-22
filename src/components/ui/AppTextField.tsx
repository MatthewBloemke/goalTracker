'use client'

import MuiTextField, { TextFieldProps } from '@mui/material/TextField'

// Thin wrapper that sets our preferred defaults so callsites stay clean.
// All MUI TextField props pass through unchanged.
export function AppTextField(props: TextFieldProps) {
  return (
    <MuiTextField
      variant="outlined"
      fullWidth
      size="small"
      {...props}
    />
  )
}
