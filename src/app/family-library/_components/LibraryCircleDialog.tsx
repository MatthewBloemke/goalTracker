'use client';

import { useState } from 'react';
import { ContentCopyRounded, GroupsRounded } from '@mui/icons-material';
import {
  Alert,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type { LibraryCircleView, LibraryFamily } from '../_lib/family-library';

export function LibraryCircleDialog({
  circle,
  families,
  familyName,
  isAdmin,
  onClose,
  onCreate,
  onJoin,
  onLeave,
}: {
  circle: LibraryCircleView | null;
  families: LibraryFamily[];
  familyName: string;
  isAdmin: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onLeave: () => Promise<void>;
}) {
  const [circleName, setCircleName] = useState(`${familyName} movie circle`);
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the library circle.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={() => !busy && onClose()}>
      <DialogTitle>Library circle</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        {error && <Alert severity="error">{error}</Alert>}
        {circle ? (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-(--surface-2) p-4">
              <GroupsRounded color="primary" />
              <div className="min-w-0">
                <h3 className="font-semibold">{circle.name}</h3>
                <p className="text-sm text-(--text-secondary)">{families.length} {families.length === 1 ? 'family' : 'families'} sharing movie ownership</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">Families</p>
              <div className="flex flex-wrap gap-2">
                {families.map((family) => <Chip key={family.id} label={family.name} />)}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Invite another family</p>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2">
                <code className="numeric-value flex-1 text-lg font-semibold tracking-[0.18em]">{circle.invite_code}</code>
                <Tooltip title={copied ? 'Copied' : 'Copy invite code'}>
                  <IconButton
                    aria-label="Copy library circle invite code"
                    onClick={async () => {
                      await navigator.clipboard.writeText(circle.invite_code);
                      setCopied(true);
                    }}
                  >
                    <ContentCopyRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
              <p className="mt-2 text-xs text-(--text-secondary)">
                Their family admin enters this code. Only movie ownership is shared.
              </p>
            </div>
            {isAdmin && (
              confirmLeave ? (
                <Alert
                  severity="warning"
                  action={(
                    <PrimaryButton
                      size="small"
                      loading={busy}
                      sx={{
                        minWidth: 70,
                        bgcolor: 'error.main',
                        '&:hover': { bgcolor: 'error.dark' },
                      }}
                      onClick={() => void run(onLeave)}
                    >
                      Leave
                    </PrimaryButton>
                  )}
                >
                  Leave this circle? Your movies stay saved but other families will no longer see them.
                </Alert>
              ) : (
                <SecondaryButton sx={{ alignSelf: 'flex-start' }} onClick={() => setConfirmLeave(true)}>
                  Leave circle
                </SecondaryButton>
              )
            )}
          </>
        ) : isAdmin ? (
          <>
            <p className="text-sm text-(--text-secondary)">
              Create one circle for the nearby families you share movies with, or join theirs.
            </p>
            <AppTextField
              label="Circle name"
              value={circleName}
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 80 } }}
              onChange={(event) => setCircleName(event.target.value)}
            />
            <PrimaryButton
              loading={busy}
              disabled={!circleName.trim()}
              onClick={() => void run(() => onCreate(circleName))}
            >
              Create circle
            </PrimaryButton>
            <Divider>Or join with a code</Divider>
            <AppTextField
              label="Library circle code"
              value={inviteCode}
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 8 } }}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            />
            <SecondaryButton
              loading={busy}
              disabled={inviteCode.trim().length !== 8}
              onClick={() => void run(() => onJoin(inviteCode))}
            >
              Join circle
            </SecondaryButton>
          </>
        ) : (
          <Alert severity="info">Ask a family admin to create or join a library circle.</Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <SecondaryButton disabled={busy} onClick={onClose}>Close</SecondaryButton>
      </DialogActions>
    </Dialog>
  );
}
