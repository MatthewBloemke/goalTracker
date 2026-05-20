'use client';

import { useState } from 'react';
import { useFamily } from '@/hooks/useFamily';
import { useSupabase } from '@/components/providers/SupabaseProvider';

export default function FamilyPage() {
  const { user } = useSupabase();
  const {
    family,
    members,
    isAdmin,
    loading,
    createFamily,
    joinFamily,
    removeMember,
    promoteMember,
  } = useFamily();
  const [view, setView] = useState<'create' | 'join' | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!familyName.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await createFamily(familyName.trim());
    console.log('Full result:', JSON.stringify(result));
    if (!result.success) setError(result.error ?? 'Failed to create family');
    setSubmitting(false);
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await joinFamily(inviteCode.trim());
    if (!result.success) setError(result.error ?? 'Failed to join family');
    setSubmitting(false);
  };

  const handleCopyCode = () => {
    if (!family) return;
    navigator.clipboard.writeText(family.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemove = async (memberId: string) => {
    const result = await removeMember(memberId);
    if (!result.success) setError(result.error ?? 'Failed to remove member');
  };

  const handlePromote = async (memberId: string) => {
    await promoteMember(memberId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{
            borderColor: 'var(--accent-green)',
            borderTopColor: 'transparent',
          }}
        />
      </div>
    );
  }

  // No family yet
  if (!family) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-6 pt-8">
        <div className="text-center">
          <h1
            className="font-serif text-3xl"
            style={{ color: 'var(--text-primary)' }}
          >
            Family Group
          </h1>
          <p
            className="text-sm mt-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Create a group to share debt progress with your family, or join one
            with an invite code.
          </p>
        </div>

        {/* Choice buttons */}
        {!view && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setView('create')}
              className="w-full py-4 rounded-2xl font-medium transition-all hover:scale-[1.01]"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="block text-2xl mb-1">🏠</span>
              Create a Family Group
            </button>
            <button
              onClick={() => setView('join')}
              className="w-full py-4 rounded-2xl font-medium transition-all hover:scale-[1.01]"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="block text-2xl mb-1">🔗</span>
              Join with Invite Code
            </button>
          </div>
        )}

        {error && (
          <p
            className="text-sm text-center px-4 py-3 rounded-xl"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--accent-red)',
            }}
          >
            {error}
          </p>
        )}

        {/* Create form */}
        {view === 'create' && (
          <div className="rounded-2xl p-6 glass flex flex-col gap-4">
            <h2
              className="font-serif text-xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Create Family Group
            </h2>
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium tracking-wide"
                style={{ color: 'var(--text-secondary)' }}
              >
                Family Name
              </label>
              <input
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="e.g. The Johnsons"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={submitting || !familyName.trim()}
                className="flex-1 py-3 rounded-xl font-medium text-sm disabled:opacity-50"
                style={{ background: 'var(--accent-green)', color: 'white' }}
              >
                {submitting ? 'Creating...' : 'Create Group'}
              </button>
              <button
                onClick={() => {
                  setView(null);
                  setError(null);
                }}
                className="px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Join form */}
        {view === 'join' && (
          <div className="rounded-2xl p-6 glass flex flex-col gap-4">
            <h2
              className="font-serif text-xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Join a Family Group
            </h2>
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium tracking-wide"
                style={{ color: 'var(--text-secondary)' }}
              >
                Invite Code
              </label>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. AB12CD34"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none font-mono tracking-widest"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                maxLength={8}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleJoin}
                disabled={submitting || inviteCode.length < 6}
                className="flex-1 py-3 rounded-xl font-medium text-sm disabled:opacity-50"
                style={{ background: 'var(--accent-green)', color: 'white' }}
              >
                {submitting ? 'Joining...' : 'Join Group'}
              </button>
              <button
                onClick={() => {
                  setView(null);
                  setError(null);
                }}
                className="px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Has a family
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="font-serif text-3xl"
            style={{ color: 'var(--text-primary)' }}
          >
            {family.name}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            {members.length} member{members.length !== 1 ? 's' : ''}
            {isAdmin && ' · You are an admin'}
          </p>
        </div>
      </div>

      {error && (
        <p
          className="text-sm px-4 py-3 rounded-xl"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--accent-red)',
          }}
        >
          {error}
        </p>
      )}

      {/* Invite code card */}
      {isAdmin && (
        <div className="rounded-2xl p-5 glass">
          <p
            className="text-xs tracking-widest uppercase font-medium mb-3"
            style={{ color: 'var(--text-secondary)' }}
          >
            Invite Code
          </p>
          <div className="flex items-center gap-3">
            <p
              className="font-mono text-2xl tracking-widest font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {family.invite_code}
            </p>
            <button
              onClick={handleCopyCode}
              className="ml-auto px-4 py-2 rounded-lg text-sm transition-all"
              style={{
                background: copied
                  ? 'rgba(16,212,126,0.15)'
                  : 'var(--surface-2)',
                border: `1px solid ${copied ? 'rgba(16,212,126,0.4)' : 'var(--border)'}`,
                color: copied ? 'var(--accent-green)' : 'var(--text-secondary)',
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p
            className="text-xs mt-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Share this code with family members so they can join
          </p>
        </div>
      )}

      {/* Members list */}
      <div className="rounded-2xl overflow-hidden glass">
        <div
          className="px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <p
            className="text-xs tracking-widest uppercase font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Members
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {members.map((member) => {
            const isCurrentUser = member.user_id === user?.id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const profile = (member as any).profiles;
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 px-5 py-4"
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-sm font-bold"
                  style={{
                    background: 'var(--surface-2)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (profile?.display_name?.[0] ?? '?').toUpperCase()
                  )}
                </div>

                {/* Name + role */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {profile?.display_name ?? 'Unknown'}
                    {isCurrentUser && (
                      <span
                        className="ml-1.5 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        (you)
                      </span>
                    )}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{
                      color:
                        member.role === 'admin'
                          ? 'var(--accent-amber)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {member.role}
                  </p>
                </div>

                {/* Admin actions */}
                {isAdmin && !isCurrentUser && (
                  <div className="flex items-center gap-2">
                    {member.role === 'member' && (
                      <button
                        onClick={() => handlePromote(member.id)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Promote
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                      style={{
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: 'var(--accent-red)',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
