'use client';

import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@mui/material';
import {
  AddRounded,
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  DeleteOutlineRounded,
  ExpandMoreRounded,
} from '@mui/icons-material';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import {
  emptyIngredient,
  formatRecipeQuantity,
  normalizeTags,
  parseRecipeQuantity,
  validateRecipe,
  type RecipeDraft,
} from '../_lib/recipes';

interface Props {
  initial: RecipeDraft;
  title: string;
  warnings?: string[];
  onClose: () => void;
  onSave: (recipe: RecipeDraft) => Promise<void>;
}

export function RecipeEditor({
  initial,
  title,
  warnings = [],
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(() => ({
    ...initial,
    ingredients: initial.ingredients.map((item) => ({
      ...item,
      quantityText: formatRecipeQuantity(item.quantity),
    })),
  }));
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const updateIngredient = (
    index: number,
    changes: Partial<(typeof draft.ingredients)[number]>,
  ) => {
    setDraft((value) => ({
      ...value,
      ingredients: value.ingredients.map((item, i) =>
        i === index ? { ...item, ...changes } : item,
      ),
    }));
  };
  const moveStep = (index: number, direction: number) =>
    setDraft((value) => {
      const instructions = [...value.instructions];
      [instructions[index], instructions[index + direction]] = [
        instructions[index + direction],
        instructions[index],
      ];
      return { ...value, instructions };
    });

  return (
    <Dialog
      open
      fullWidth
      maxWidth="md"
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) return;
          setError('');
          setSaving(true);
          try {
            await onSave(
              validateRecipe({
                ...draft,
                ingredients: draft.ingredients.map((item, index) => {
                  try {
                    return {
                      ...item,
                      // Merely opening/saving an existing recipe must not
                      // replace its precise number with a display approximation.
                      quantity:
                        item.quantityText ===
                        formatRecipeQuantity(item.quantity)
                          ? item.quantity
                          : parseRecipeQuantity(item.quantityText),
                    };
                  } catch {
                    throw new Error(
                      `Ingredient ${index + 1}: use a positive quantity like 1/2 or 1 1/2 (at most 100,000).`,
                    );
                  }
                }),
                tags: normalizeTags(tags.split(',')),
              }),
            );
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : 'Unable to save this recipe.',
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <DialogContent className="flex flex-col gap-5">
          {warnings.length > 0 && (
            <Alert severity="warning">
              <strong>Review before saving</strong>
              <ul className="list-disc pl-5">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <fieldset
            disabled={saving}
            className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0"
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <AppTextField
                label="Recipe name"
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <AppTextField
                label="Servings"
                type="number"
                value={draft.servings ?? ''}
                slotProps={{
                  htmlInput: { min: 0.01, max: 100000, step: 'any' },
                }}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    servings: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
            <AppTextField
              label="Tags"
              helperText="Separate tags with commas, e.g. weeknight, chicken, freezer-friendly"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <h3 className="font-semibold">Ingredients</h3>
            <p className="-mt-3 text-sm text-(--text-secondary)">
              Use fractions like 1/2 or 1 1/2. Leave quantity blank for “to
              taste”.
            </p>
            {draft.ingredients.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-(--border) p-3"
              >
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <AppTextField
                    label={`Ingredient ${index + 1}`}
                    required
                    value={item.name}
                    onChange={(e) =>
                      updateIngredient(index, { name: e.target.value })
                    }
                  />
                  <IconButton
                    aria-label={`Remove ingredient ${index + 1}`}
                    disabled={draft.ingredients.length === 1}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        ingredients: draft.ingredients.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    <DeleteOutlineRounded />
                  </IconButton>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[110px_130px_1fr]">
                  <AppTextField
                    label="Quantity"
                    value={item.quantityText}
                    placeholder="1/2"
                    onChange={(e) =>
                      updateIngredient(index, {
                        quantityText: e.target.value,
                      })
                    }
                  />
                  <AppTextField
                    label="Unit"
                    placeholder="tsp, cups, lb"
                    value={item.unit}
                    onChange={(e) =>
                      updateIngredient(index, { unit: e.target.value })
                    }
                  />
                  <AppTextField
                    label="Preparation / notes"
                    placeholder="chopped, divided, to taste"
                    value={item.preparation}
                    onChange={(e) =>
                      updateIngredient(index, { preparation: e.target.value })
                    }
                  />
                </div>
              </div>
            ))}
            <SecondaryButton
              startIcon={<AddRounded />}
              disabled={draft.ingredients.length >= 100}
              onClick={() =>
                setDraft({
                  ...draft,
                  ingredients: [
                    ...draft.ingredients,
                    { ...emptyIngredient(), quantityText: '' },
                  ],
                })
              }
            >
              Add ingredient
            </SecondaryButton>
            <Accordion disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                Shopping quantities (advanced)
              </AccordionSummary>
              <AccordionDetails className="flex flex-col gap-4">
                <p className="text-sm text-(--text-secondary)">
                  Used only when building a shopping list. For example, 1 tsp of
                  paprika needs 1 container. Package sizes vary: check that the
                  amount you buy covers the recipe. These values do not change
                  the cooking quantities.
                </p>
                {draft.ingredients.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 sm:grid-cols-[1fr_110px_140px]"
                  >
                    <span className="self-center text-sm">
                      {item.name || `Ingredient ${index + 1}`}
                    </span>
                    <AppTextField
                      label={`Buy quantity ${index + 1}`}
                      type="number"
                      required
                      value={item.shoppingQuantity}
                      slotProps={{ htmlInput: { min: 0.0001, step: 'any' } }}
                      onChange={(e) =>
                        updateIngredient(index, {
                          shoppingQuantity: Number(e.target.value),
                        })
                      }
                    />
                    <AppTextField
                      label={`Buy unit ${index + 1}`}
                      required
                      value={item.shoppingUnit}
                      onChange={(e) =>
                        updateIngredient(index, {
                          shoppingUnit: e.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </AccordionDetails>
            </Accordion>
            <h3 className="font-semibold">Instructions</h3>
            {draft.instructions.map((step, index) => (
              <div key={index} className="flex items-start gap-2">
                <AppTextField
                  label={`Step ${index + 1}`}
                  required
                  multiline
                  minRows={2}
                  value={step}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      instructions: draft.instructions.map((s, i) =>
                        i === index ? e.target.value : s,
                      ),
                    })
                  }
                />
                <div className="flex flex-col">
                  <IconButton
                    size="small"
                    aria-label={`Move step ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                  >
                    <ArrowUpwardRounded fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Move step ${index + 1} down`}
                    disabled={index === draft.instructions.length - 1}
                    onClick={() => moveStep(index, 1)}
                  >
                    <ArrowDownwardRounded fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Remove step ${index + 1}`}
                    disabled={draft.instructions.length === 1}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        instructions: draft.instructions.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </div>
              </div>
            ))}
            <SecondaryButton
              startIcon={<AddRounded />}
              disabled={draft.instructions.length >= 100}
              onClick={() =>
                setDraft({
                  ...draft,
                  instructions: [...draft.instructions, ''],
                })
              }
            >
              Add step
            </SecondaryButton>
            <AppTextField
              label="Source link (optional)"
              value={draft.sourceUrl}
              onChange={(e) =>
                setDraft({ ...draft, sourceUrl: e.target.value })
              }
            />
            <AppTextField
              label="Notes (optional)"
              multiline
              minRows={2}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </fieldset>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <SecondaryButton disabled={saving} onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" loading={saving}>
            Save recipe
          </PrimaryButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}
