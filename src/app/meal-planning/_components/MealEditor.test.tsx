import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MealEditor } from './MealEditor';
import type { SavedRecipe } from '../_lib/recipes';
import type { PlannedMeal } from '../_lib/meal-plan';

jest.mock('./ShoppingListDialog', () => ({
  ShoppingListDialog: () => <div>Shopping review</div>,
}));
const recipe: SavedRecipe = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Soup',
  family_id: null,
  user_id: 'user',
  servings: 4,
  source_url: '',
  notes: '',
  tags: [],
  created_at: '',
  updated_at: '',
  recipe_ingredients: [],
  recipe_steps: [
    { id: 'step', recipe_id: 'recipe', position: 0, instruction: 'Simmer.' },
  ],
};
const existing: PlannedMeal = {
  id: 'meal',
  user_id: 'user',
  family_id: null,
  meal_date: '2026-10-25',
  meal_type: 'dinner',
  recipe_id: recipe.id,
  title: 'Soup night',
  notes: '',
  created_at: '',
  updated_at: 'revision',
};
const props = () => ({
  date: '2026-10-25',
  recipes: [recipe],
  recipesLoading: false,
  recipesError: null,
  onClose: jest.fn(),
  onSave: jest.fn().mockResolvedValue(undefined),
  onRemove: jest.fn().mockResolvedValue(undefined),
});

test('custom meals require explicit save and can be rescheduled with notes', async () => {
  const handlers = props();
  render(<MealEditor {...handlers} />);
  expect(handlers.onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Custom meal' }));
  fireEvent.change(screen.getByLabelText('Meal name'), {
    target: { value: ' Leftovers ' },
  });
  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: '2026-10-26' },
  });
  fireEvent.change(screen.getByLabelText('Meal notes'), {
    target: { value: ' Reheat soup ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save meal' }));
  await waitFor(() =>
    expect(handlers.onSave).toHaveBeenCalledWith({
      meal_date: '2026-10-26',
      meal_type: 'dinner',
      title: 'Leftovers',
      notes: 'Reheat soup',
      recipe_id: null,
    }),
  );
  expect(handlers.onClose).toHaveBeenCalled();
});
test('linked recipes retain their ID and expose instructions and the existing shopping review', async () => {
  const handlers = props();
  render(<MealEditor {...handlers} existing={existing} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'View recipe · 4 servings' }),
  );
  expect(await screen.findByText('Simmer.')).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Add recipe to shopping list' }),
  );
  expect(screen.getByText('Shopping review')).toBeInTheDocument();
  expect(handlers.onSave).not.toHaveBeenCalled();
});
test('selecting a saved recipe prefills its title but allows edits before saving', async () => {
  const handlers = props();
  render(<MealEditor {...handlers} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Recipe' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Soup' }));
  expect(screen.getByLabelText('Meal name')).toHaveValue('Soup');
  fireEvent.click(screen.getByRole('button', { name: 'Save meal' }));
  await waitFor(() =>
    expect(handlers.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ recipe_id: recipe.id, title: 'Soup' }),
    ),
  );
});
test('deletion requires confirmation and does not save a meal', async () => {
  const handlers = props();
  render(<MealEditor {...handlers} existing={existing} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove meal' }));
  expect(handlers.onRemove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));
  await waitFor(() => expect(handlers.onRemove).toHaveBeenCalledTimes(1));
  expect(handlers.onSave).not.toHaveBeenCalled();
});
test('failed or stale edits retain the draft instead of silently closing', async () => {
  const handlers = props();
  handlers.onSave.mockRejectedValue(new Error('This meal changed. Reopen it.'));
  render(<MealEditor {...handlers} existing={existing} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save meal' }));
  expect(
    await screen.findByText('This meal changed. Reopen it.'),
  ).toBeInTheDocument();
  expect(handlers.onClose).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Meal name')).toHaveValue('Soup night');
});
test('a missing recipe cannot be silently saved; the user can explicitly keep it as custom', async () => {
  const handlers = props();
  render(<MealEditor {...handlers} recipes={[]} existing={existing} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save meal' }));
  expect(
    await screen.findByText(
      'Choose an available recipe, or switch to a custom meal.',
    ),
  ).toBeInTheDocument();
  expect(handlers.onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Custom meal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save meal' }));
  await waitFor(() =>
    expect(handlers.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ recipe_id: null, title: 'Soup night' }),
    ),
  );
});
