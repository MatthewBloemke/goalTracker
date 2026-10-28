'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { orderTaskItems } from '@/app/task-planner/_lib/task-planner';
import type { TaskItem, TaskList } from '@/types';

export interface TaskInput {
  name: string;
  notes?: string;
}

export function useTaskList(listId: string, familyId?: string | null) {
  const { supabase, user } = useSupabase();
  const [list, setList] = useState<TaskList | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchList = useCallback(
    async (showLoading = false) => {
      const requestId = ++requestIdRef.current;
      if (!user || !familyId) {
        setList(null);
        setTasks([]);
        setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);
      setError(null);

      const query = supabase.from('task_lists').select('*').eq('id', listId);
      const listResult = await query.eq('family_id', familyId).maybeSingle();

      if (requestId !== requestIdRef.current) return;
      if (listResult.error) {
        setError(listResult.error.message);
        setList(null);
        setTasks([]);
        setLoading(false);
        return;
      }
      if (!listResult.data) {
        setList(null);
        setTasks([]);
        setLoading(false);
        return;
      }

      const itemResult = await supabase
        .from('task_items')
        .select('*')
        .eq('list_id', listId)
        .order('sort_order')
        .order('created_at');

      if (requestId !== requestIdRef.current) return;
      if (itemResult.error) {
        setError(itemResult.error.message);
        setList(listResult.data);
        setTasks([]);
        setLoading(false);
        return;
      }

      setList(listResult.data);
      setTasks(itemResult.data ?? []);
      setLoading(false);
    },
    [familyId, listId, supabase, user],
  );

  useEffect(() => {
    void Promise.resolve().then(() => fetchList(true));
  }, [fetchList]);

  useEffect(() => {
    if (!user || !familyId) return;
    let refreshTimer: number | undefined;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void fetchList(), 120);
    };

    const channel = supabase
      .channel(`task-list:${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_lists',
          filter: `id=eq.${listId}`,
        },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_items',
          filter: `list_id=eq.${listId}`,
        },
        refresh,
      )
      .subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'));

    return () => {
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [familyId, fetchList, listId, supabase, user]);

  const runMutation = useCallback(
    async (operation: () => Promise<void>) => {
      setMutating(true);
      setError(null);
      try {
        await operation();
        await fetchList();
        return true;
      } catch (mutationError) {
        setError(
          mutationError instanceof Error
            ? mutationError.message
            : 'Unable to update this task list.',
        );
        return false;
      } finally {
        setMutating(false);
      }
    },
    [fetchList],
  );

  const createTask = useCallback(
    (input: TaskInput) =>
      runMutation(async () => {
        if (!user || !input.name.trim()) throw new Error('Task name is required.');
        const nextSortOrder =
          tasks.reduce((highest, task) => Math.max(highest, task.sort_order), -1) +
          1;
        const { error: createError } = await supabase.from('task_items').insert({
          list_id: listId,
          created_by: user.id,
          name: input.name.trim(),
          notes: input.notes?.trim() || null,
          sort_order: nextSortOrder,
        });
        if (createError) throw createError;
      }),
    [listId, runMutation, supabase, tasks, user],
  );

  const updateTask = useCallback(
    (taskId: string, input: TaskInput) =>
      runMutation(async () => {
        if (!input.name.trim()) throw new Error('Task name is required.');
        const { error: updateError } = await supabase
          .from('task_items')
          .update({
            name: input.name.trim(),
            notes: input.notes?.trim() || null,
          })
          .eq('id', taskId)
          .eq('list_id', listId);
        if (updateError) throw updateError;
      }),
    [listId, runMutation, supabase],
  );

  const toggleTask = useCallback(
    (task: TaskItem) =>
      runMutation(async () => {
        const { error: updateError } = await supabase
          .from('task_items')
          .update({ completed_at: task.completed_at ? null : new Date().toISOString() })
          .eq('id', task.id)
          .eq('list_id', listId);
        if (updateError) throw updateError;
      }),
    [listId, runMutation, supabase],
  );

  const deleteTask = useCallback(
    (taskId: string) =>
      runMutation(async () => {
        const { error: deleteError } = await supabase
          .from('task_items')
          .delete()
          .eq('id', taskId)
          .eq('list_id', listId);
        if (deleteError) throw deleteError;
      }),
    [listId, runMutation, supabase],
  );

  const renameList = useCallback(
    (name: string) =>
      runMutation(async () => {
        if (!name.trim()) throw new Error('List name is required.');
        const { error: updateError } = await supabase
          .from('task_lists')
          .update({ name: name.trim() })
          .eq('id', listId);
        if (updateError) throw updateError;
      }),
    [listId, runMutation, supabase],
  );

  const deleteList = useCallback(
    () =>
      runMutation(async () => {
        const { error: deleteError } = await supabase
          .from('task_lists')
          .delete()
          .eq('id', listId);
        if (deleteError) throw deleteError;
      }),
    [listId, runMutation, supabase],
  );

  const reorderTasks = useCallback(
    async (orderedIds: string[]) => {
      const reordered = orderTaskItems(tasks, orderedIds);
      if (!reordered) return false;

      const previousTasks = tasks;
      setMutating(true);
      setTasks(reordered);
      setError(null);
      const { error: reorderError } = await supabase.rpc('reorder_task_items', {
        target_list_id: listId,
        ordered_item_ids: orderedIds,
      });
      if (reorderError) {
        setTasks(previousTasks);
        setError(reorderError.message);
        setMutating(false);
        return false;
      }
      setMutating(false);
      return true;
    },
    [listId, supabase, tasks],
  );

  return {
    list,
    tasks,
    loading,
    mutating,
    realtimeConnected,
    error,
    createTask,
    updateTask,
    toggleTask,
    deleteTask,
    reorderTasks,
    renameList,
    deleteList,
    refetch: fetchList,
  };
}
