import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShoppingListDialog } from './ShoppingListDialog';
import type { SavedRecipe } from '../_lib/recipes';

const rpc = jest.fn();
const push = jest.fn();
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ supabase: { rpc } }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/app/task-planner/_hooks/useTaskLists', () => ({
  useTaskLists: () => ({
    lists: [{ id: 'list-1', name: 'Groceries' }],
    loading: false,
    error: null,
  }),
}));

const recipe: SavedRecipe = {
  id: 'recipe-1',
  user_id: 'user',
  family_id: 'family',
  title: 'Soup',
  servings: null,
  source_url: '',
  notes: '',
  tags: [],
  created_at: '',
  updated_at: '',
  recipe_steps: [],
  recipe_ingredients: ['salt', 'pepper'].map((name, position) => ({
    id: name,
    recipe_id: 'recipe-1',
    name,
    position,
    quantity: 1,
    unit: 'tsp',
    preparation: '',
    shopping_quantity: 1,
    shopping_unit: 'container',
  })),
};

test('only checked ingredient IDs are copied through the atomic RPC, never before confirmation', async () => {
  rpc.mockResolvedValue({ data: 'new-list', error: null });
  render(<ShoppingListDialog recipe={recipe} onClose={jest.fn()} />);
  expect(rpc).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', { name: '1 container salt' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 items' }));
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith('add_recipe_to_task_list', {
      source_recipe_id: 'recipe-1',
      ingredient_ids: ['pepper'],
      target_list_id: null,
      new_list_name: 'Shopping list',
    }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Open shopping list' }),
  );
  expect(push).toHaveBeenCalledWith('/task-planner/new-list');
  expect(
    screen.queryByRole('button', { name: 'Add 1 items' }),
  ).not.toBeInTheDocument();
});

test('errors preserve selections and permit retry without reporting success', async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: 'Recipe was edited. Reopen it.' },
  });
  render(<ShoppingListDialog recipe={recipe} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add 2 items' }));
  expect(
    await screen.findByText('Recipe was edited. Reopen it.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Open shopping list' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('checkbox', { name: '1 container pepper' }),
  ).toBeChecked();
});
