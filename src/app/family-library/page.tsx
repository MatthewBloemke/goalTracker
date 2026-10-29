'use client';

import { Alert, CircularProgress } from '@mui/material';
import { useFamily } from '@/hooks/useFamily';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { FamilyLibrary } from './_components/FamilyLibrary';

export default function FamilyLibraryPage() {
  const { user, loading: authLoading } = useSupabase();
  const { family, isAdmin, loading, error } = useFamily();
  if (loading || authLoading) {
    return <div className="p-10 text-center"><CircularProgress aria-label="Loading family library" /></div>;
  }
  if (error) return <Alert severity="error">Unable to determine your family: {error}</Alert>;
  if (!user) return <Alert severity="info">Sign in to view the family library.</Alert>;
  if (!family) return null;
  return (
    <FamilyLibrary
      key={`${user.id}:${family.id}`}
      familyId={family.id}
      familyName={family.name}
      isAdmin={isAdmin}
    />
  );
}
