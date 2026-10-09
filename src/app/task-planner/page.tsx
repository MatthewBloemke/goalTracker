'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useFamily } from '@/hooks/useFamily';
import {
  useTaskLists,
  type TaskListSummary,
} from '@/app/task-planner/_hooks/useTaskLists';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';

export default function TaskPlannerPage() {
  const router = useRouter();
  const { family, loading: familyLoading } = useFamily();
  const {
    lists,
    loading,
    mutating,
    realtimeConnected,
    error,
    createList,
    updateList,
    deleteList,
  } = useTaskLists(family?.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<TaskListSummary | null>(null);

  if (familyLoading || loading) return <TaskPlannerLoading />;

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingList(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl text-(--text-primary)">
              Task Planner
            </h1>
            <LiveIndicator connected={realtimeConnected} />
          </div>
          <p className="mt-1 text-sm text-(--text-secondary)">
            {family
              ? `${family.name}'s shared project lists`
              : 'Your personal project lists'}
          </p>
        </div>
        <PrimaryButton
          startIcon={<AddRounded />}
          onClick={() => setDialogOpen(true)}
        >
          New list
        </PrimaryButton>
      </header>

      {error && <Alert severity="error">{error}</Alert>}

      {lists.length === 0 ? (
        <section className="glass flex min-h-72 flex-col items-center justify-center rounded-3xl p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/10 text-2xl text-sky-400">
            ✓
          </div>
          <h2 className="mt-5 font-serif text-2xl text-(--text-primary)">
            Start with a project list
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-(--text-secondary)">
            Make a list for organizing a room, planning a repair, preparing for
            a move, or anything else you want to break into prioritized steps.
          </p>
          <PrimaryButton
            sx={{ mt: 3 }}
            startIcon={<AddRounded />}
            onClick={() => setDialogOpen(true)}
          >
            Create your first list
          </PrimaryButton>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <TaskListCard
              key={list.id}
              list={list}
              onEdit={() => {
                setEditingList(list);
                setDialogOpen(true);
              }}
              onDelete={async () => {
                if (
                  window.confirm(
                    `Delete “${list.name}” and all of its tasks? This cannot be undone.`,
                  )
                ) {
                  await deleteList(list.id);
                }
              }}
            />
          ))}
        </section>
      )}

      {dialogOpen && (
        <ListDialog
          open
          initialName={editingList?.name ?? ''}
          title={editingList ? 'Rename list' : 'New task list'}
          saveLabel={editingList ? 'Save name' : 'Create list'}
          loading={mutating}
          onClose={closeDialog}
          onSave={async (name) => {
            if (editingList) {
              if (await updateList(editingList.id, name)) closeDialog();
              return;
            }
            const created = await createList(name);
            if (created) router.push(`/task-planner/${created.id}`);
          }}
        />
      )}
    </div>
  );
}

function TaskListCard({
  list,
  onEdit,
  onDelete,
}: {
  list: TaskListSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const remaining = list.taskCount - list.completedCount;

  return (
    <article className="glass group relative overflow-hidden rounded-2xl border border-(--border) transition-transform hover:-translate-y-0.5">
      <Link href={`/task-planner/${list.id}`} className="block min-h-44 p-5 pr-14">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">
          Project list
        </p>
        <h2 className="mt-3 font-serif text-2xl text-(--text-primary)">
          {list.name}
        </h2>
        <p className="mt-6 text-sm text-(--text-secondary)">
          {list.taskCount === 0
            ? 'No tasks yet'
            : remaining === 0
              ? `All ${list.taskCount} tasks complete`
              : `${remaining} of ${list.taskCount} tasks remaining`}
        </p>
        {list.taskCount > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-(--surface-2)">
            <div
              className="h-full rounded-full bg-sky-400 transition-[width]"
              style={{
                width: `${(list.completedCount / list.taskCount) * 100}%`,
              }}
            />
          </div>
        )}
      </Link>
      <IconButton
        aria-label={`Actions for ${list.name}`}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          position: 'absolute',
          right: 10,
          top: 10,
          color: 'var(--text-secondary)',
        }}
      >
        <MoreHorizRounded />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onEdit();
          }}
        >
          <EditRounded fontSize="small" sx={{ mr: 1.5 }} /> Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onDelete();
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineRounded fontSize="small" sx={{ mr: 1.5 }} /> Delete
        </MenuItem>
      </Menu>
    </article>
  );
}

function ListDialog({
  open,
  initialName,
  title,
  saveLabel,
  loading,
  onClose,
  onSave,
}: {
  open: boolean;
  initialName: string;
  title: string;
  saveLabel: string;
  loading: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <form
          className="mt-2 flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSave(name);
          }}
        >
          <AppTextField
            autoFocus
            required
            label="List name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Organize the garage"
          />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={loading} disabled={!name.trim()}>
              {saveLabel}
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
      <span
        className="h-2 w-2 rounded-full"
        style={{
          background: connected ? 'var(--accent-green)' : 'var(--accent-amber)',
        }}
      />
      {connected ? 'Live' : 'Connecting'}
    </span>
  );
}

function TaskPlannerLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2"
        style={{ borderColor: '#38bdf8', borderTopColor: 'transparent' }}
      />
    </div>
  );
}
