'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import {
  activeMovieLoan,
  formatLoanTimestamp,
  movieMediaFormatLabel,
  type LibraryFamily,
  type MovieCopy,
  type MovieOwner,
} from '../_lib/family-library';

export function LoanStatusDialog({
  movieTitle,
  owner,
  copy,
  families,
  currentFamilyId,
  onClose,
  onLend,
  onReturn,
  onRemove,
}: {
  movieTitle: string;
  owner: MovieOwner;
  copy: MovieCopy;
  families: LibraryFamily[];
  currentFamilyId: string;
  onClose: () => void;
  onLend: (borrowerFamilyId: string) => Promise<void>;
  onReturn: (loanId: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const borrowers = useMemo(
    () => families.filter(({ id }) => id !== owner.id),
    [families, owner.id],
  );
  const [borrowerId, setBorrowerId] = useState(borrowers[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeLoan = activeMovieLoan(copy);
  const canManage = owner.id === currentFamilyId;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update this movie loan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={() => !busy && onClose()}>
      <DialogTitle>
        {movieTitle} · {movieMediaFormatLabel(copy.mediaFormat)}
      </DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        {error && <Alert severity="error">{error}</Alert>}
        <p className="text-sm text-(--text-secondary)">Owned by {owner.name}</p>
        {activeLoan ? (
          <Alert severity="warning">
            Borrowed by <strong>{activeLoan.borrower_family_name}</strong> since{' '}
            <span className="numeric-value">{formatLoanTimestamp(activeLoan.borrowed_at)}</span>.
          </Alert>
        ) : (
          <Alert severity="success">Available</Alert>
        )}

        {canManage && activeLoan && (
          <PrimaryButton
            loading={busy}
            onClick={() => void run(() => onReturn(activeLoan.id))}
          >
            Mark returned
          </PrimaryButton>
        )}

        {canManage && !activeLoan && borrowers.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-(--border) p-4">
            <h3 className="font-semibold">Lend this copy</h3>
            <FormControl fullWidth size="small">
              <InputLabel id="movie-borrower-label">Borrowed by</InputLabel>
              <Select
                labelId="movie-borrower-label"
                label="Borrowed by"
                value={borrowerId}
                disabled={busy}
                onChange={(event) => setBorrowerId(event.target.value)}
              >
                {borrowers.map((family) => (
                  <MenuItem key={family.id} value={family.id}>{family.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <PrimaryButton
              loading={busy}
              disabled={!borrowerId}
              onClick={() => void run(() => onLend(borrowerId))}
            >
              Mark as borrowed
            </PrimaryButton>
          </div>
        )}
        {canManage && !activeLoan && borrowers.length === 0 && (
          <Alert severity="info">Connect another family before lending this copy.</Alert>
        )}

        <section aria-labelledby="loan-history-heading">
          <h3 id="loan-history-heading" className="mb-2 font-semibold">Loan history</h3>
          {copy.loans.length === 0 ? (
            <p className="text-sm text-(--text-secondary)">This copy has not been borrowed yet.</p>
          ) : (
            <ol className="divide-y divide-(--border) rounded-2xl border border-(--border)">
              {copy.loans.map((loan) => {
                return (
                  <li key={loan.id} className="p-3 text-sm">
                    <div className="font-medium">{loan.borrower_family_name}</div>
                    <div className="numeric-value mt-1 text-xs text-(--text-secondary)">
                      Borrowed {formatLoanTimestamp(loan.borrowed_at)}
                      {loan.returned_at
                        ? ` · Returned ${formatLoanTimestamp(loan.returned_at)}`
                        : ' · Not returned'}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {canManage && !activeLoan && (
          <SecondaryButton
            disabled={busy}
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => {
              if (!window.confirm(`Remove the ${movieMediaFormatLabel(copy.mediaFormat)} copy of ${movieTitle}? Its loan history will also be removed.`)) return;
              void run(onRemove);
            }}
          >
            Remove copy
          </SecondaryButton>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <SecondaryButton disabled={busy} onClick={onClose}>Close</SecondaryButton>
      </DialogActions>
    </Dialog>
  );
}
