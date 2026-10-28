'use client';

import { FamilyContext } from '@/components/providers/FamilyContext';
import { useFamilyState } from '@/hooks/useFamily';

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const familyState = useFamilyState();

  return (
    <FamilyContext.Provider value={familyState}>
      {children}
    </FamilyContext.Provider>
  );
}
