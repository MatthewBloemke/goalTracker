'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import type {
  Family,
  FamilySettings,
  SnowballStrategy,
  MemberWithFamily,
  FamilyMemberWithProfile,
  InsertFamily,
  InsertFamilyMember,
  InsertFamilySettings,
} from '@/types';

export function useFamily() {
  const { supabase, user } = useSupabase();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMemberWithProfile[]>([]);
  const [settings, setSettings] = useState<FamilySettings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchFamily = useCallback(async (showLoading = false) => {
    const requestId = ++requestIdRef.current;

    if (!user) {
      setFamily(null);
      setMembers([]);
      setSettings(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);

    try {
      const { data: rawMember, error: memberError } = await supabase
        .from('family_members')
        .select('*, families(*)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (requestId !== requestIdRef.current) return;

      if (memberError) throw memberError;

      if (!rawMember) {
        setFamily(null);
        setMembers([]);
        setSettings(null);
        setIsAdmin(false);
        return;
      }

      const memberData = rawMember as unknown as MemberWithFamily;
      const familyData = memberData.families;

      const [{ data: allMembers, error: membersError }, { data: settingsData, error: settingsError }] =
        await Promise.all([
          supabase
            .from('family_members')
            .select('id, family_id, user_id, role, joined_at')
            .eq('family_id', familyData.id),
          supabase
            .from('family_settings')
            .select('*')
            .eq('family_id', familyData.id)
            .maybeSingle(),
        ]);

      if (requestId !== requestIdRef.current) return;
      if (membersError) throw membersError;
      if (settingsError) throw settingsError;

      const userIds = (allMembers ?? []).map((m) => m.user_id);
      const { data: profilesData, error: profilesError } = userIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, user_id, display_name, avatar_url')
            .in('user_id', userIds)
        : { data: [], error: null };

      if (requestId !== requestIdRef.current) return;
      if (profilesError) throw profilesError;

      const profileMap = new Map(
        (profilesData ?? []).map((profile) => [profile.user_id, profile]),
      );
      const membersWithProfiles = (allMembers ?? []).map((member) => ({
        ...member,
        profiles: profileMap.get(member.user_id) ?? null,
      }));

      setFamily(familyData);
      setIsAdmin(memberData.role === 'admin');
      setMembers(membersWithProfiles as unknown as FamilyMemberWithProfile[]);
      setSettings(settingsData as FamilySettings | null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load family');
      setFamily(null);
      setMembers([]);
      setSettings(null);
      setIsAdmin(false);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    void Promise.resolve().then(() => fetchFamily(true));
  }, [fetchFamily]);

  // Realtime: watch for member changes
  useEffect(() => {
    if (!user || !family) return;

    const channel = supabase
      .channel('family-members-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_members',
          filter: `family_id=eq.${family.id}`,
        },
        () => fetchFamily(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user, family, fetchFamily]);

  const createFamily = useCallback(
    async (name: string) => {
      if (!user) return { success: false, error: 'Not authenticated' };

      // Re-fetch the session to ensure we have a fresh token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session)
        return {
          success: false,
          error: 'Session expired, please sign in again',
        };

      const familyInsert: InsertFamily = { name, created_by: session.user.id };

      // Insert without chained select — the select RLS policy blocks the
      // chained read because family_members doesn't exist yet at that point
      const { error: familyError } = await supabase
        .from('families')
        .insert(familyInsert);

      if (familyError) {
        console.error('createFamily error:', familyError);
        return { success: false, error: familyError?.message };
      }

      // Now fetch the newly created family separately
      const { data: newFamily, error: fetchError } = await supabase
        .from('families')
        .select('*')
        .eq('created_by', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !newFamily)
        return { success: false, error: fetchError?.message };

      const memberInsert: InsertFamilyMember = {
        family_id: newFamily.id,
        user_id: user.id,
        role: 'admin',
      };
      await supabase.from('family_members').insert(memberInsert);

      const settingsInsert: InsertFamilySettings = {
        family_id: newFamily.id,
        strategy: 'snowball',
        extra_monthly_budget: 0,
      };
      await supabase.from('family_settings').insert(settingsInsert);

      await fetchFamily();
      return { success: true };
    },
    [supabase, user, fetchFamily],
  );

  const joinFamily = useCallback(
    async (inviteCode: string) => {
      if (!user) return { success: false };

      // Use invite_code lookup via a public-accessible query
      // We need the family id before we're a member, so we use created_by-independent lookup
      const { data: targetFamilies, error: lookupError } = await supabase
        .from('families')
        .select('id, name')
        .eq('invite_code', inviteCode.toUpperCase())
        .limit(1);

      if (lookupError || !targetFamilies || targetFamilies.length === 0) {
        return { success: false, error: 'Invalid invite code' };
      }

      const targetFamily = targetFamilies[0] as unknown as Family;

      const memberInsert: InsertFamilyMember = {
        family_id: targetFamily.id,
        user_id: user.id,
        role: 'member',
      };
      const { error: joinError } = await supabase
        .from('family_members')
        .insert(memberInsert);

      if (joinError) return { success: false, error: joinError.message };

      await fetchFamily();
      return { success: true };
    },
    [supabase, user, fetchFamily],
  );

  const updateStrategy = useCallback(
    async (strategy: SnowballStrategy) => {
      if (!settings) return;
      await supabase
        .from('family_settings')
        .update({ strategy })
        .eq('id', settings.id);
      setSettings((prev) => (prev ? { ...prev, strategy } : null));
    },
    [supabase, settings],
  );

  const updateExtraBudget = useCallback(
    async (amount: number) => {
      if (!settings) return;
      await supabase
        .from('family_settings')
        .update({ extra_monthly_budget: amount })
        .eq('id', settings.id);
      setSettings((prev) =>
        prev ? { ...prev, extra_monthly_budget: amount } : null,
      );
    },
    [supabase, settings],
  );

  const removeMember = useCallback(
    async (memberId: string): Promise<{ success: boolean; error?: string }> => {
      // Prevent removing the last admin
      const memberToRemove = members.find((m) => m.id === memberId);
      if (memberToRemove?.role === 'admin') {
        const adminCount = members.filter((m) => m.role === 'admin').length;
        if (adminCount <= 1) {
          return {
            success: false,
            error:
              'Cannot remove the last admin. Promote another member first.',
          };
        }
      }
      await supabase.from('family_members').delete().eq('id', memberId);
      await fetchFamily();
      return { success: true };
    },
    [supabase, fetchFamily, members],
  );

  const promoteMember = useCallback(
    async (memberId: string): Promise<{ success: boolean }> => {
      await supabase
        .from('family_members')
        .update({ role: 'admin' })
        .eq('id', memberId);
      await fetchFamily();
      return { success: true };
    },
    [supabase, fetchFamily],
  );

  return {
    family,
    members,
    settings,
    isAdmin,
    loading,
    error,
    createFamily,
    joinFamily,
    updateStrategy,
    updateExtraBudget,
    removeMember,
    promoteMember,
    refetch: fetchFamily,
  };
}
