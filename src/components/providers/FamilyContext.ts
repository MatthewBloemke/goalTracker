'use client';

import { createContext } from 'react';
import type { FamilyState } from '@/hooks/useFamily';

export const FamilyContext = createContext<FamilyState | undefined>(undefined);
