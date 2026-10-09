'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import {
  buildTaskListSummaries,
  type TaskListSummary,
} from '@/app/task-planner/_lib/task-planner';
import type { TaskList } from '@/types';

export type { TaskListSummary } from '@/app/task-planner/_lib/task-planner';

export function useTaskLists(familyId?: string | null) {
  const { supabase, user } = useSupabase();
  const [lists, setLists] = useState<TaskListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchLists = useCallback(
    async (showLoading = false) => {
      const requestId = ++requestIdRef.current;
      if (!user) {
        setLists([]);
        setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);
      setError(null);

      const query = supabase
        .from('task_lists')
        .select('*')
        .order('created_at', { ascending: false });
      const listResult = await (familyId
        ? query.eq('family_id', familyId)
        : query.is('family_id', null).eq('user_id', user.id));

      if (requestId !== requestIdRef.current) return;
      if (listResult.error) {
        setError(listResult.error.message);
        setLists([]);
        setLoading(false);
        return;
      }

      const scopedLists = listResult.data ?? [];
      const itemResult =
        scopedLists.length > 0
          ? await supabase
              .from('task_items')
              .select('list_id, completed_at')
              .in(
                'list_id',
                scopedLists.map(({ id }) => id),
              )
          : { data: [], error: null };

      if (requestId !== requestIdRef.current) return;
      if (itemResult.error) {
        setError(itemResult.error.message);
        setLists([]);
        setLoading(false);
        return;
      }

      setLists(buildTaskListSummaries(scopedLists, itemResult.data ?? []));
      setLoading(false);
    },
    [familyId, supabase, user],
  );

  useEffect(() => {
    void Promise.resolve().then(() => fetchLists(true));
  }, [fetchLists]);

  useEffect(() => {
    if (!user) return;
    let refreshTimer: number | undefined;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void fetchLists(), 120);
    };

    const channel = supabase
      .channel(`task-lists:${familyId ?? user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_lists' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_items' },
        refresh,
      )
      .subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'));

    return () => {
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [familyId, fetchLists, supabase, user]);

  const createList = useCallback(
    async (name: string): Promise<TaskList | null> => {
      if (!user || !name.trim()) return null;
      setMutating(true);
      setError(null);
      const { data, error: createError } = await supabase
        .from('task_lists')
        .insert({
          user_id: user.id,
          family_id: familyId ?? null,
          name: name.trim(),
        })
        .select('*')
        .single();

      if (createError) {
        setError(createError.message);
        setMutating(false);
        return null;
      }

      await fetchLists();
      setMutating(false);
      return data;
    },
    [familyId, fetchLists, supabase, user],
  );

  const updateList = useCallback(
    async (listId: string, name: string) => {
      if (!name.trim()) return false;
      setMutating(true);
      setError(null);
      const { error: updateError } = await supabase
        .from('task_lists')
        .update({ name: name.trim() })
        .eq('id', listId);
      if (updateError) setError(updateError.message);
      else await fetchLists();
      setMutating(false);
      return !updateError;
    },
    [fetchLists, supabase],
  );

  const deleteList = useCallback(
    async (listId: string) => {
      setMutating(true);
      setError(null);
      const { error: deleteError } = await supabase
        .from('task_lists')
        .delete()
        .eq('id', listId);
      if (deleteError) setError(deleteError.message);
      else await fetchLists();
      setMutating(false);
      return !deleteError;
    },
    [fetchLists, supabase],
  );

  return {
    lists,
    loading,
    mutating,
    realtimeConnected,
    error,
    createList,
    updateList,
    deleteList,
    refetch: fetchLists,
  };
}
