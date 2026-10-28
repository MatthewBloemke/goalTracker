'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import {
  validateMealDraft,
  type MealDraft,
  type PlannedMeal,
} from '../_lib/meal-plan';

export function useMealPlan(
  familyId: string | null,
  start: string,
  end: string,
) {
  const { supabase, user } = useSupabase();
  const key = `${user?.id}:${familyId}:${start}:${end}`;
  const [state, setState] = useState<{
    key: string;
    meals: PlannedMeal[];
    error: string | null;
  }>({ key: '', meals: [], error: null });
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      if (!user) throw new Error('Sign in to view your meal plan.');
      if (!familyId) throw new Error('Create or join a family first.');
      const query = supabase
        .from('meal_plan_entries')
        .select('*')
        .gte('meal_date', start)
        .lte('meal_date', end)
        .order('meal_date')
        .order('created_at');
      const result = await query.eq('family_id', familyId);
      if (result.error) throw new Error(result.error.message);
      if (request === sequence.current)
        setState({ key, meals: result.data ?? [], error: null });
    } catch (error) {
      if (request === sequence.current)
        setState({
          key,
          meals: [],
          error:
            error instanceof Error
              ? error.message
              : 'Unable to load your meal plan.',
        });
    }
  }, [supabase, user, familyId, start, end, key]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const requests = sequence;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (active) void refresh();
      }, 100);
    };
    void Promise.resolve().then(() => {
      if (active) void refresh();
    });
    if (!user || !familyId) {
      return () => {
        active = false;
        ++requests.current;
        clearTimeout(timer);
      };
    }
    const channel = supabase
      .channel(`meal-plan:${key}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meal_plan_entries' },
        reload,
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          setRealtimeError(null);
          reload();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
          setRealtimeError(
            'Live updates are disconnected. Use Refresh to check for family changes.',
          );
      });
    window.addEventListener('focus', reload);
    return () => {
      active = false;
      ++requests.current;
      clearTimeout(timer);
      window.removeEventListener('focus', reload);
      void supabase.removeChannel(channel);
    };
  }, [familyId, key, refresh, supabase, user]);

  const save = async (draft: MealDraft, existing?: PlannedMeal) => {
    if (!user) throw new Error('Sign in to plan meals.');
    if (!familyId) throw new Error('Create or join a family first.');
    const values = validateMealDraft(draft);
    const result = existing
      ? await supabase
          .from('meal_plan_entries')
          .update(values)
          .eq('id', existing.id)
          .eq('updated_at', existing.updated_at)
          .select('id')
      : await supabase
          .from('meal_plan_entries')
          .insert({ ...values, user_id: user.id, family_id: familyId })
          .select('id');
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length)
      throw new Error(
        'This meal changed or was removed. Close and reopen it before saving.',
      );
    await refresh();
  };
  const remove = async (meal: PlannedMeal) => {
    if (!familyId) throw new Error('Create or join a family first.');
    const result = await supabase
      .from('meal_plan_entries')
      .delete()
      .eq('id', meal.id)
      .eq('updated_at', meal.updated_at)
      .select('id');
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length)
      throw new Error(
        'This meal changed or was removed. Close and reopen it before deleting.',
      );
    await refresh();
  };

  return {
    meals: state.key === key ? state.meals : [],
    loading: state.key !== key,
    error: state.key === key ? state.error : null,
    realtimeError,
    refresh,
    save,
    remove,
  };
}
