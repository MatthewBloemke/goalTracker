'use client';

import { Alert, CircularProgress } from '@mui/material';
import { useFamily } from '@/hooks/useFamily';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { MealPlanner } from './_components/MealPlanner';

export default function MealPlanningPage() {
  const { user, loading: authLoading } = useSupabase();
  const { family, loading, error } = useFamily();
  if (loading || authLoading)
    return (
      <div className="p-8 text-center">
        <CircularProgress aria-label="Loading meal plan" />
      </div>
    );
  if (error)
    return (
      <Alert severity="error">
        Unable to determine your meal plan: {error}
      </Alert>
    );
  if (!user) return <Alert severity="info">Sign in to plan your meals.</Alert>;
  if (!family) return null;
  return (
    <MealPlanner
      key={`${user.id}:${family.id}`}
      familyId={family.id}
      familyName={family.name}
    />
  );
}
