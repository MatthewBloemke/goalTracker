'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import {
  validateRecipe,
  type RecipeDraft,
  type SavedRecipe,
} from '../_lib/recipes';
import type { Json } from '@/types/database';

export function useRecipes(familyId: string | null | undefined) {
  const { supabase, user } = useSupabase();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    if (!user || !familyId) {
      setRecipes([]);
      setLoading(false);
      return;
    }
    const query = supabase
      .from('recipes')
      .select('*, recipe_ingredients(*), recipe_steps(*)')
      .order('title');
    const result = await query.eq('family_id', familyId);
    if (request !== sequence.current) return;
    setError(result.error?.message ?? null);
    if (!result.error) setRecipes(result.data ?? []);
    setLoading(false);
  }, [supabase, user, familyId]);

  useEffect(() => {
    let active = true;
    const requests = sequence;
    let timer: ReturnType<typeof setTimeout>;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (active) void refresh();
      }, 120);
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
      .channel(`recipes:${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipes' },
        reload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipe_ingredients' },
        reload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipe_steps' },
        reload,
      )
      .subscribe();
    return () => {
      active = false;
      ++requests.current;
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [refresh, supabase, familyId, user]);

  const save = async (draft: RecipeDraft, existing?: SavedRecipe) => {
    if (!familyId) throw new Error('Create or join a family first.');
    const validated = validateRecipe(draft);
    const { data, error } = await supabase.rpc('save_recipe', {
      recipe_data: validated as unknown as Json,
      target_id: existing?.id ?? null,
      target_family_id: familyId,
      expected_updated_at: existing?.updated_at ?? null,
    });
    if (error) throw new Error(error.message);
    await refresh();
    return data;
  };

  const remove = async (id: string) => {
    if (!familyId) throw new Error('Create or join a family first.');
    const { data, error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data?.length)
      throw new Error('Recipe was already deleted or is no longer accessible.');
    await refresh();
  };

  return { recipes, loading, error, save, remove, refresh };
}
