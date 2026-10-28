'use client';

import { useEffect, useState, useCallback, useContext, useRef } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { FamilyContext } from '@/components/providers/FamilyContext';
import type {
  Family,
  FamilySettings,
  SnowballStrategy,
  MemberWithFamily,
  FamilyMemberWithProfile,
} from '@/types';

export function useFamilyState() {
  const { supabase, user } = useSupabase();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMemberWithProfile[]>([]);
  const [settings, setSettings] = useState<FamilySettings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchFamily = useCallback(
    async (showLoading = false) => {
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

        const [
          { data: allMembers, error: membersError },
          { data: settingsData, error: settingsError },
        ] = await Promise.all([
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
        const { data: profilesData, error: profilesError } =
          userIds.length > 0
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
    },
    [supabase, user],
  );

  useEffect(() => {
    void Promise.resolve().then(() => fetchFamily(true));
  }, [fetchFamily]);

  // Realtime: watch this user's membership plus changes to the active family.
  useEffect(() => {
    if (!user) return;

    let channel = supabase
      .channel('family-members-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_members',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchFamily(),
      );

    if (family) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_members',
          filter: `family_id=eq.${family.id}`,
        },
        () => fetchFamily(),
      );
    }

    channel.subscribe();
    const refreshOnFocus = () => void fetchFamily();
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      supabase.removeChannel(channel);
    };
  }, [supabase, user, family, fetchFamily]);

  const createFamily = useCallback(
    async (name: string) => {
      if (!user) return { success: false, error: 'Not authenticated' };
      const { error: createError } = await supabase.rpc(
        'create_family_for_current_user',
        { family_name: name },
      );
      if (createError) {
        return { success: false, error: createError.message };
      }

      await fetchFamily();
      return { success: true };
    },
    [supabase, user, fetchFamily],
  );

  const joinFamily = useCallback(
    async (inviteCode: string) => {
      if (!user) return { success: false };
      const { error: joinError } = await supabase.rpc(
        'join_family_with_invite',
        { invite_code_input: inviteCode },
      );

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

  const leaveFamily = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!user || !family) {
      return { success: false, error: 'You are not currently in a family.' };
    }

    const currentMember = members.find((member) => member.user_id === user.id);
    if (!currentMember) {
      return { success: false, error: 'Your family membership was not found.' };
    }

    const adminCount = members.filter((member) => member.role === 'admin').length;
    if (currentMember.role === 'admin' && adminCount <= 1) {
      return {
        success: false,
        error: 'Promote another member to admin before leaving the family.',
      };
    }

    const { error: leaveError } = await supabase
      .from('family_members')
      .delete()
      .eq('id', currentMember.id)
      .eq('user_id', user.id);

    if (leaveError) {
      return { success: false, error: leaveError.message };
    }

    await fetchFamily();
    return { success: true };
  }, [family, fetchFamily, members, supabase, user]);

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
    leaveFamily,
    updateStrategy,
    updateExtraBudget,
    removeMember,
    promoteMember,
    refetch: fetchFamily,
  };
}

export type FamilyState = ReturnType<typeof useFamilyState>;

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within FamilyProvider');
  }
  return context;
}
