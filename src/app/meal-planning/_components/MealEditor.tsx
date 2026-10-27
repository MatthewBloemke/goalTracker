'use client';

import { useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { ExpandMoreRounded, ShoppingCartOutlined } from '@mui/icons-material';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import {
  MEAL_TYPES,
  mealLabels,
  validateMealDraft,
  type MealDraft,
  type PlannedMeal,
} from '../_lib/meal-plan';
import { recipeToDraft, type SavedRecipe } from '../_lib/recipes';
import { RecipeInstructions } from './RecipeInstructions';
import { ShoppingListDialog } from './ShoppingListDialog';

export function MealEditor({
  date,
  existing,
  recipes,
  recipesLoading,
  recipesError,
  onClose,
  onSave,
  onRemove,
}: {
  date: string;
  existing?: PlannedMeal;
  recipes: SavedRecipe[];
  recipesLoading: boolean;
  recipesError: string | null;
  onClose: () => void;
  onSave: (draft: MealDraft) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<MealDraft>(
    existing ?? {
      meal_date: date,
      meal_type: 'dinner',
      recipe_id: null,
      title: '',
      notes: '',
    },
  );
  const [mode, setMode] = useState<'recipe' | 'custom'>(
    existing ? (existing.recipe_id ? 'recipe' : 'custom') : 'recipe',
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [shopping, setShopping] = useState(false);
  const recipe = recipes.find((item) => item.id === draft.recipe_id);
  const run = async (action: () => Promise<void>) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Unable to update this meal.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Dialog
        open
        fullWidth
        maxWidth="md"
        onClose={() => {
          if (!busy && !shopping) onClose();
        }}
        aria-labelledby="meal-editor-title"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              if (mode === 'recipe' && !recipe)
                throw new Error(
                  'Choose an available recipe, or switch to a custom meal.',
                );
              await onSave(
                validateMealDraft({
                  ...draft,
                  recipe_id: mode === 'recipe' ? recipe!.id : null,
                }),
              );
            });
          }}
        >
          <DialogTitle id="meal-editor-title">
            {existing ? 'Planned meal' : 'Plan a meal'}
          </DialogTitle>
          <DialogContent className="flex flex-col gap-5">
            {error && <Alert severity="error">{error}</Alert>}
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <AppTextField
                label="Date"
                type="date"
                value={draft.meal_date}
                disabled={busy}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: '1000-01-01', max: '9999-12-31' },
                }}
                onChange={(e) =>
                  setDraft({ ...draft, meal_date: e.target.value })
                }
              />
              <AppTextField
                label="Meal"
                select
                value={draft.meal_type}
                disabled={busy}
                onChange={(e) =>
                  setDraft({ ...draft, meal_type: e.target.value })
                }
              >
                {MEAL_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {mealLabels[type]}
                  </MenuItem>
                ))}
              </AppTextField>
            </div>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              disabled={busy}
              aria-label="Meal source"
              onChange={(_, value: 'recipe' | 'custom' | null) => {
                if (value) setMode(value);
              }}
            >
              <ToggleButton value="recipe">Saved recipe</ToggleButton>
              <ToggleButton value="custom">Custom meal</ToggleButton>
            </ToggleButtonGroup>
            {mode === 'recipe' && (
              <>
                {recipesError && (
                  <Alert severity="warning">
                    Recipes could not be loaded: {recipesError}. You can still
                    plan a custom meal.
                  </Alert>
                )}
                <Autocomplete
                  options={recipes}
                  value={recipe ?? null}
                  loading={recipesLoading}
                  disabled={busy || recipesLoading || !!recipesError}
                  getOptionLabel={(option) => option.title}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  noOptionsText="No saved recipes yet. Add one in Recipes, or plan a custom meal."
                  onChange={(_, selected) =>
                    setDraft({
                      ...draft,
                      recipe_id: selected?.id ?? null,
                      title: selected?.title ?? draft.title,
                    })
                  }
                  renderInput={(params) => (
                    <AppTextField {...params} label="Recipe" />
                  )}
                />
                {draft.recipe_id &&
                  !recipe &&
                  !recipesLoading &&
                  !recipesError && (
                    <Alert severity="warning">
                      This recipe is no longer available. Choose another recipe
                      or keep the meal as a custom entry.
                    </Alert>
                  )}
              </>
            )}
            <AppTextField
              label="Meal name"
              value={draft.title}
              disabled={busy}
              helperText={
                mode === 'custom'
                  ? 'For example: Leftovers, takeout, or dinner with family.'
                  : 'You can customize the name shown on the calendar.'
              }
              slotProps={{ htmlInput: { maxLength: 160 } }}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <AppTextField
              label="Meal notes"
              multiline
              minRows={2}
              value={draft.notes}
              disabled={busy}
              helperText="Prep reminders, sides, or who is cooking."
              slotProps={{ htmlInput: { maxLength: 4000 } }}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
            {mode === 'recipe' && recipe && (
              <>
                <Accordion disableGutters>
                  <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                    View recipe
                    {recipe.servings ? ` · ${recipe.servings} servings` : ''}
                  </AccordionSummary>
                  <AccordionDetails>
                    <RecipeInstructions recipe={recipeToDraft(recipe)} />
                  </AccordionDetails>
                </Accordion>
                <SecondaryButton
                  startIcon={<ShoppingCartOutlined />}
                  disabled={busy}
                  onClick={() => setShopping(true)}
                >
                  Add recipe to shopping list
                </SecondaryButton>
                <p className="text-xs text-(--text-secondary)">
                  Shopping uses the recipe’s saved purchase quantities. It does
                  not automatically add items when you plan a meal.
                </p>
              </>
            )}
            {deleting && (
              <Alert
                severity="warning"
                action={
                  <SecondaryButton
                    disabled={busy}
                    onClick={() => void run(onRemove)}
                  >
                    Confirm removal
                  </SecondaryButton>
                }
              >
                Remove this meal from the plan? The saved recipe and shopping
                tasks will remain.
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, flexWrap: 'wrap', gap: 1 }}>
            {existing && (
              <SecondaryButton
                sx={{ mr: 'auto', color: 'error.main' }}
                disabled={busy}
                onClick={() => setDeleting(!deleting)}
              >
                {deleting ? 'Keep meal' : 'Remove meal'}
              </SecondaryButton>
            )}
            <SecondaryButton disabled={busy} onClick={onClose}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" loading={busy}>
              Save meal
            </PrimaryButton>
          </DialogActions>
        </form>
      </Dialog>
      {shopping && recipe && (
        <ShoppingListDialog
          recipe={recipe}
          onClose={() => setShopping(false)}
        />
      )}
    </>
  );
}
