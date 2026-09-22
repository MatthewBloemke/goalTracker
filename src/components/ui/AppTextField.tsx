'use client'

import TextField, { type TextFieldProps } from '@mui/material/TextField'

/** Shared Material UI text field with the Family Portal defaults. */
export function AppTextField(props: TextFieldProps) {
  return <TextField fullWidth size="small" variant="outlined" {...props} />
}
