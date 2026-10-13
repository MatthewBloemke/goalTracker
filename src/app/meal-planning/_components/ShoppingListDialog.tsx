'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
} from '@mui/material';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useTaskLists } from '@/app/task-planner/_hooks/useTaskLists';
import {
  ingredientLabel,
  recipeToDraft,
  type SavedRecipe,
} from '../_lib/recipes';

export function ShoppingListDialog({
  recipe,
  onClose,
}: {
  recipe: SavedRecipe;
  onClose: () => void;
}) {
  const { supabase } = useSupabase();
  const router = useRouter();
  const { lists, loading, error: listError } = useTaskLists(recipe.family_id);
  const ingredients = [...recipe.recipe_ingredients].sort(
    (a, b) => a.position - b.position,
  );
  const draft = recipeToDraft(recipe);
  const [selected, setSelected] = useState(ingredients.map((item) => item.id));
  const [target, setTarget] = useState('');
  const [newName, setNewName] = useState('Shopping list');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [addedList, setAddedList] = useState<string | null>(null);

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <DialogTitle>Shop for {recipe.title}</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        {addedList ? (
          <Alert severity="success">
            Added {selected.length} items to your task list. They can be
            reordered and checked off there.
          </Alert>
        ) : (
          <>
            <p className="text-sm text-(--text-secondary)">
              Uncheck anything already in your pantry. Quantities below are
              amounts to buy, not cooking measures. Existing tasks are kept;
              adding a recipe again adds another set of items.
            </p>
            {error && <Alert severity="error">{error}</Alert>}
            {listError && <Alert severity="error">{listError}</Alert>}
            <AppTextField
              select
              label="Task list"
              value={target}
              disabled={loading || busy}
              onChange={(e) => setTarget(e.target.value)}
            >
              <MenuItem value="">Create a new shopping list</MenuItem>
              {lists.map((list) => (
                <MenuItem key={list.id} value={list.id}>
                  {list.name}
                </MenuItem>
              ))}
            </AppTextField>
            {!target && (
              <AppTextField
                label="New list name"
                value={newName}
                disabled={busy}
                onChange={(e) => setNewName(e.target.value)}
              />
            )}
            <div className="flex flex-col">
              {ingredients.map((item, index) => (
                <FormControlLabel
                  key={item.id}
                  control={
                    <Checkbox
                      disabled={busy}
                      checked={selected.includes(item.id)}
                      onChange={(_, checked) =>
                        setSelected((ids) =>
                          checked
                            ? [...ids, item.id]
                            : ids.filter((id) => id !== item.id),
                        )
                      }
                    />
                  }
                  label={ingredientLabel(draft.ingredients[index], true)}
                />
              ))}
            </div>
            <p className="text-xs text-(--text-secondary)">
              Need a different package amount? Cancel and edit the recipe’s
              advanced shopping quantities.
            </p>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <SecondaryButton disabled={busy} onClick={onClose}>
          {addedList ? 'Done' : 'Cancel'}
        </SecondaryButton>
        {addedList ? (
          <PrimaryButton
            onClick={() => router.push(`/task-planner/${addedList}`)}
          >
            Open shopping list
          </PrimaryButton>
        ) : (
          <PrimaryButton
            loading={busy}
            disabled={
              loading ||
              !!listError ||
              selected.length === 0 ||
              (!target && !newName.trim())
            }
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                const result = await supabase.rpc('add_recipe_to_task_list', {
                  source_recipe_id: recipe.id,
                  ingredient_ids: selected,
                  target_list_id: target || null,
                  new_list_name: newName.trim(),
                });
                if (result.error) throw new Error(result.error.message);
                setAddedList(result.data);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : 'Unable to add shopping items.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Add {selected.length} items
          </PrimaryButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
