'use client';

import { OutlinedInput, OutlinedInputProps } from '@mui/material';

// Thin wrapper that sets our preferred defaults so callsites stay clean.
// All MUI TextField props pass through unchanged.
export function AppTextField(props: OutlinedInputProps) {
  return <OutlinedInput fullWidth size="small" {...props} />;
}
