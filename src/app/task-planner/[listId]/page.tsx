'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { move } from '@dnd-kit/helpers';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import AddRounded from '@mui/icons-material/AddRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useFamily } from '@/hooks/useFamily';
import {
  useTaskList,
  type TaskInput,
} from '@/app/task-planner/_hooks/useTaskList';
import { splitTaskItems } from '@/app/task-planner/_lib/task-planner';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type { TaskItem } from '@/types';

export default function TaskListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = use(params);
  const router = useRouter();
  const { family, loading: familyLoading } = useFamily();
  const {
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
  } = useTaskList(listId, family?.id);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const completionTimers = useRef(new Map<string, number>());

  useEffect(
    () => () => {
      for (const timer of completionTimers.current.values()) {
        window.clearTimeout(timer);
      }
    },
    [],
  );

  if (familyLoading || loading) return <TaskListLoading />;
  if (!family) return null;

  if (!list) {
    return (
      <div className="glass mx-auto max-w-xl rounded-3xl p-8 text-center">
        <h1 className="font-serif text-2xl text-(--text-primary)">
          List not available
        </h1>
        {error ? (
          <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
            {error}
          </Alert>
        ) : (
          <p className="mt-2 text-sm text-(--text-secondary)">
            This list may have been deleted, or it belongs to a scope that is
            not currently active.
          </p>
        )}
        <SecondaryButton component={Link} href="/task-planner" sx={{ mt: 3 }}>
          Back to Task Planner
        </SecondaryButton>
      </div>
    );
  }

  const { active: activeTasks, completed: completedTasks } =
    splitTaskItems(tasks);
  const completedCount = completedTasks.length;
  const closeTaskDialog = () => {
    setTaskDialogOpen(false);
    setEditingTask(null);
  };
  const handleToggle = (task: TaskItem) => {
    if (task.completed_at) {
      void toggleTask(task);
      return;
    }
    if (completionTimers.current.has(task.id)) return;

    setCompletingTaskIds((current) => new Set(current).add(task.id));
    const timer = window.setTimeout(async () => {
      completionTimers.current.delete(task.id);
      await toggleTask(task);
      setCompletingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }, 400);
    completionTimers.current.set(task.id, timer);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        href="/task-planner"
        className="w-fit text-sm text-(--text-secondary) hover:text-(--text-primary)"
      >
        ← All task lists
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl text-(--text-primary)">
              {list.name}
            </h1>
            <span className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: realtimeConnected
                    ? 'var(--accent-green)'
                    : 'var(--accent-amber)',
                }}
              />
              {realtimeConnected ? 'Live' : 'Connecting'}
            </span>
          </div>
          <p className="mt-1 text-sm text-(--text-secondary)">
            {tasks.length === 0
              ? `${family.name}'s shared list`
              : `${completedCount} of ${tasks.length} complete · top tasks are highest priority`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            startIcon={<EditRounded />}
            onClick={() => setRenameOpen(true)}
          >
            Rename
          </SecondaryButton>
          <PrimaryButton
            startIcon={<AddRounded />}
            onClick={() => setTaskDialogOpen(true)}
          >
            Add task
          </PrimaryButton>
        </div>
      </header>

      {error && <Alert severity="error">{error}</Alert>}

      {tasks.length === 0 ? (
        <section className="glass flex min-h-64 flex-col items-center justify-center rounded-3xl p-8 text-center">
          <CheckRounded sx={{ fontSize: 44, color: '#38bdf8' }} />
          <h2 className="mt-4 font-serif text-2xl text-(--text-primary)">
            Break this project into steps
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-(--text-secondary)">
            Add the things you want to remember, then drag them into the order
            you want to tackle them.
          </p>
          <PrimaryButton
            sx={{ mt: 3 }}
            startIcon={<AddRounded />}
            onClick={() => setTaskDialogOpen(true)}
          >
            Add the first task
          </PrimaryButton>
        </section>
      ) : activeTasks.length > 0 ? (
        <DragDropProvider
          onDragEnd={(event) => {
            if (event.canceled) return;
            const reordered = move(activeTasks, event);
            const activeOrderChanged = reordered.some(
              ({ id }, index) => id !== activeTasks[index]?.id,
            );
            if (activeOrderChanged) {
              const orderedIds = [...reordered, ...completedTasks].map(
                ({ id }) => id,
              );
              void reorderTasks(orderedIds);
            }
          }}
        >
          <section className="flex flex-col gap-3" aria-label="Prioritized tasks">
            {activeTasks.map((task, index) => (
              <SortableTask
                key={task.id}
                task={task}
                index={index}
                completing={completingTaskIds.has(task.id)}
                disabled={mutating || completingTaskIds.has(task.id)}
                onToggle={() => handleToggle(task)}
                onEdit={() => {
                  setEditingTask(task);
                  setTaskDialogOpen(true);
                }}
                onDelete={() => {
                  if (window.confirm(`Delete “${task.name}”?`)) {
                    void deleteTask(task.id);
                  }
                }}
              />
            ))}
          </section>
        </DragDropProvider>
      ) : (
        <section className="glass rounded-2xl p-6 text-center">
          <CheckRounded sx={{ fontSize: 36, color: '#38bdf8' }} />
          <h2 className="mt-2 font-serif text-xl text-(--text-primary)">
            Everything on this list is complete
          </h2>
          <p className="mt-1 text-sm text-(--text-secondary)">
            Expand completed tasks below if you need to restore anything.
          </p>
        </section>
      )}

      {completedTasks.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
          <Button
            fullWidth
            color="inherit"
            onClick={() => setCompletedOpen((open) => !open)}
            aria-expanded={completedOpen}
            endIcon={
              <ExpandMoreRounded
                sx={{
                  transform: completedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 160ms ease',
                }}
              />
            }
            sx={{
              justifyContent: 'space-between',
              px: 2.5,
              py: 1.75,
              color: 'var(--text-primary)',
              '& .MuiButton-endIcon': { ml: 'auto' },
            }}
          >
            Completed ({completedTasks.length})
          </Button>
          <Collapse in={completedOpen}>
            <div className="flex flex-col gap-2 border-t border-(--border) p-3">
              {completedTasks.map((task) => (
                <CompletedTask
                  key={task.id}
                  task={task}
                  disabled={mutating}
                  onRestore={() => handleToggle(task)}
                  onEdit={() => {
                    setEditingTask(task);
                    setTaskDialogOpen(true);
                  }}
                  onDelete={() => {
                    if (window.confirm(`Delete “${task.name}”?`)) {
                      void deleteTask(task.id);
                    }
                  }}
                />
              ))}
            </div>
          </Collapse>
        </section>
      )}

      <div className="border-t border-(--border) pt-5">
        <SecondaryButton
          startIcon={<DeleteOutlineRounded />}
          sx={{ color: 'var(--accent-red)', borderColor: 'rgba(239,68,68,0.3)' }}
          onClick={async () => {
            if (
              window.confirm(
                `Delete “${list.name}” and all of its tasks? This cannot be undone.`,
              ) &&
              (await deleteList())
            ) {
              router.push('/task-planner');
            }
          }}
        >
          Delete list
        </SecondaryButton>
      </div>

      {taskDialogOpen && (
        <TaskDialog
          open
          task={editingTask}
          loading={mutating}
          onClose={closeTaskDialog}
          onSave={async (input) => {
            const saved = editingTask
              ? await updateTask(editingTask.id, input)
              : await createTask(input);
            if (saved) closeTaskDialog();
          }}
        />
      )}

      {renameOpen && (
        <NameDialog
          open
          initialName={list.name}
          loading={mutating}
          onClose={() => setRenameOpen(false)}
          onSave={async (name) => {
            if (await renameList(name)) setRenameOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SortableTask({
  task,
  index,
  completing,
  disabled,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: TaskItem;
  index: number;
  completing: boolean;
  disabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: task.id,
    index,
    disabled,
  });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <article
      ref={ref}
      className="glass flex items-start gap-2 rounded-2xl border border-(--border) p-3 sm:gap-3 sm:p-4"
      style={{ opacity: isDragging ? 0.55 : 1 }}
    >
      <IconButton
        ref={handleRef}
        aria-label={`Drag ${task.name} to reorder`}
        disabled={disabled}
        sx={{
          mt: 0.25,
          color: 'var(--text-secondary)',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <DragIndicatorRounded />
      </IconButton>
      <Checkbox
        checked={completing}
        onChange={onToggle}
        disabled={disabled}
        slotProps={{
          input: { 'aria-label': `Mark ${task.name} complete` },
        }}
        sx={{
          color: 'var(--text-secondary)',
          '&.Mui-checked': { color: '#38bdf8' },
        }}
      />
      <div className="min-w-0 flex-1 pt-1.5">
        <h2
          className="text-base font-medium text-(--text-primary)"
          style={{
            textDecoration: completing ? 'line-through' : 'none',
            opacity: completing ? 0.62 : 1,
            transition: 'opacity 160ms ease',
          }}
        >
          {task.name}
        </h2>
        {task.notes && (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-(--text-secondary)">
            {task.notes}
          </p>
        )}
      </div>
      <TaskActions
        task={task}
        anchor={anchor}
        onOpen={setAnchor}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </article>
  );
}

function CompletedTask({
  task,
  disabled,
  onRestore,
  onEdit,
  onDelete,
}: {
  task: TaskItem;
  disabled: boolean;
  onRestore: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <article className="flex items-start gap-2 rounded-xl bg-(--surface-2) p-3 sm:gap-3">
      <Checkbox
        checked
        onChange={onRestore}
        disabled={disabled}
        slotProps={{
          input: { 'aria-label': `Mark ${task.name} incomplete` },
        }}
        sx={{ color: '#38bdf8', '&.Mui-checked': { color: '#38bdf8' } }}
      />
      <div className="min-w-0 flex-1 pt-1.5 opacity-65">
        <h3 className="text-sm font-medium text-(--text-primary) line-through">
          {task.name}
        </h3>
        {task.notes && (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-(--text-secondary)">
            {task.notes}
          </p>
        )}
      </div>
      <TaskActions
        task={task}
        anchor={anchor}
        onOpen={setAnchor}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </article>
  );
}

function TaskActions({
  task,
  anchor,
  onOpen,
  onEdit,
  onDelete,
}: {
  task: TaskItem;
  anchor: HTMLElement | null;
  onOpen: (anchor: HTMLElement | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <IconButton
        aria-label={`Actions for ${task.name}`}
        onClick={(event) => onOpen(event.currentTarget)}
        sx={{ color: 'var(--text-secondary)' }}
      >
        <MoreHorizRounded />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => onOpen(null)}>
        <MenuItem
          onClick={() => {
            onOpen(null);
            onEdit();
          }}
        >
          <EditRounded fontSize="small" sx={{ mr: 1.5 }} /> Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            onOpen(null);
            onDelete();
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineRounded fontSize="small" sx={{ mr: 1.5 }} /> Delete
        </MenuItem>
      </Menu>
    </>
  );
}

function TaskDialog({
  open,
  task,
  loading,
  onClose,
  onSave,
}: {
  open: boolean;
  task: TaskItem | null;
  loading: boolean;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<void>;
}) {
  const [name, setName] = useState(task?.name ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{task ? 'Edit task' : 'Add task'}</DialogTitle>
      <DialogContent>
        <form
          className="mt-2 flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSave({ name, notes });
          }}
        >
          <AppTextField
            autoFocus
            required
            label="Task name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sort and donate clothes from the hall closet"
          />
          <AppTextField
            multiline
            minRows={4}
            label="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Details, reminders, supplies, or anything else that will help"
          />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={loading} disabled={!name.trim()}>
              {task ? 'Save task' : 'Add task'}
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NameDialog({
  open,
  initialName,
  loading,
  onClose,
  onSave,
}: {
  open: boolean;
  initialName: string;
  loading: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>Rename list</DialogTitle>
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
          />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={loading} disabled={!name.trim()}>
              Save name
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskListLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2"
        style={{ borderColor: '#38bdf8', borderTopColor: 'transparent' }}
      />
    </div>
  );
}
