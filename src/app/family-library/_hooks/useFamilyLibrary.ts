'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import type {
  LibraryCircleView,
  LibraryFamily,
  LibraryMovieRow,
} from '../_lib/family-library';

interface LibraryState {
  circle: LibraryCircleView | null;
  families: LibraryFamily[];
  movies: LibraryMovieRow[];
  error: string | null;
}

export function useFamilyLibrary(familyId: string, familyName: string) {
  const { supabase, user } = useSupabase();
  const sequence = useRef(0);
  const [state, setState] = useState<LibraryState>({
    circle: null,
    families: [{ id: familyId, name: familyName }],
    movies: [],
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = false) => {
    const request = ++sequence.current;
    if (showLoading) setLoading(true);
    try {
      if (!user) throw new Error('Sign in to view the family library.');
      const { data: ownMembership, error: membershipError } = await supabase
        .from('library_circle_families')
        .select('circle_id')
        .eq('family_id', familyId)
        .maybeSingle();
      if (membershipError) throw new Error(membershipError.message);

      let circle: LibraryCircleView | null = null;
      let families: LibraryFamily[] = [{ id: familyId, name: familyName }];
      if (ownMembership) {
        const [{ data: circleData, error: circleError }, { data: memberships, error: membersError }] = await Promise.all([
          supabase
            .from('library_circles')
            .select('id, name, invite_code, created_by_family_id, created_at')
            .eq('id', ownMembership.circle_id)
            .single(),
          supabase.from('library_circle_families').select('family_id').eq('circle_id', ownMembership.circle_id),
        ]);
        if (circleError) throw new Error(circleError.message);
        if (membersError) throw new Error(membersError.message);
        const familyIds = (memberships ?? []).map(({ family_id }) => family_id);
        const { data: familyRows, error: familiesError } = await supabase
          .rpc('get_library_families');
        if (familiesError) throw new Error(familiesError.message);
        circle = circleData;
        const expectedFamilyIds = new Set(familyIds);
        families = (familyRows ?? []).filter(({ id }) => expectedFamilyIds.has(id));
      }

      const familyIds = families.map(({ id }) => id);
      const { data: movies, error: moviesError } = await supabase
        .from('family_movies')
        .select('id, family_id, tmdb_movie_id, title, original_title, release_date, poster_path, backdrop_path, overview, genres, created_at, updated_at')
        .in('family_id', familyIds)
        .order('title');
      if (moviesError) throw new Error(moviesError.message);
      if (request === sequence.current) {
        setState({ circle, families, movies: movies ?? [], error: null });
      }
    } catch (error) {
      if (request === sequence.current) {
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : 'Unable to load the family library.',
        }));
      }
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [familyId, familyName, supabase, user]);

  useEffect(() => {
    void Promise.resolve().then(() => refresh(true));
  }, [refresh]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 100);
    };
    const channel = supabase
      .channel(`family-library:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_movies' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_circle_families' }, reload)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeError(null);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeError('Live updates are disconnected. Use refresh to check for changes.');
        }
      });
    window.addEventListener('focus', reload);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', reload);
      void supabase.removeChannel(channel);
    };
  }, [familyId, refresh, supabase]);

  const createCircle = async (name: string) => {
    const { error } = await supabase.rpc('create_library_circle', { circle_name: name });
    if (error) throw new Error(error.message);
    await refresh();
  };
  const joinCircle = async (code: string) => {
    const { error } = await supabase.rpc('join_library_circle', { invite_code_input: code });
    if (error) throw new Error(error.message);
    await refresh();
  };
  const leaveCircle = async () => {
    const { error } = await supabase.rpc('leave_library_circle');
    if (error) throw new Error(error.message);
    await refresh();
  };
  const removeMovie = async (libraryMovieId: string) => {
    const { error } = await supabase
      .from('family_movies')
      .delete()
      .eq('id', libraryMovieId)
      .eq('family_id', familyId);
    if (error) throw new Error(error.message);
    await refresh();
  };

  return {
    ...state,
    loading,
    realtimeError,
    refresh,
    createCircle,
    joinCircle,
    leaveCircle,
    removeMovie,
  };
}
