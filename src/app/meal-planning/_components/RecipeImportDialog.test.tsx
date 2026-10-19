import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TextEncoder } from 'node:util';
import { RecipeImportDialog } from './RecipeImportDialog';
import { emptyRecipe, serializeRecipe } from '../_lib/recipes';

Object.assign(globalThis, { TextEncoder });
const invoke = jest.fn();
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ supabase: { functions: { invoke } } }),
}));
const recipe = {
  ...emptyRecipe(),
  title: 'Soup',
  ingredients: [
    {
      name: 'salt',
      quantity: 1,
      unit: 'tsp',
      preparation: '',
      shoppingQuantity: 1,
      shoppingUnit: 'container',
    },
  ],
  instructions: ['Stir.'],
};

test('AI results go only to review, not a database save', async () => {
  invoke.mockResolvedValue({
    data: { recipe, warnings: ['Check quantity.'] },
    error: null,
  });
  const review = jest.fn();
  render(<RecipeImportDialog onClose={jest.fn()} onReview={review} />);
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Recipe text, caption or transcript' }),
    { target: { value: 'Soup: 1 tsp salt. Stir.' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Extract recipe' }));
  await waitFor(() =>
    expect(review).toHaveBeenCalledWith(
      recipe,
      expect.arrayContaining(['Check quantity.']),
    ),
  );
  expect(invoke).toHaveBeenCalledWith('analyze-recipe', {
    body: { sourceUrl: '', text: 'Soup: 1 tsp salt. Stir.' },
  });
});

test('file import requires no AI request and strips ownership fields', async () => {
  const review = jest.fn();
  render(<RecipeImportDialog onClose={jest.fn()} onReview={review} />);
  const file = new File([serializeRecipe(recipe)], 'soup.recipe.json', {
    type: 'application/json',
  });
  Object.defineProperty(file, 'text', {
    value: async () => serializeRecipe(recipe),
  });
  fireEvent.change(screen.getByLabelText('Import recipe file'), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(review).toHaveBeenCalledWith(recipe, expect.any(Array)),
  );
  expect(invoke).not.toHaveBeenCalled();
});

test('invalid model output cannot open the review or save a recipe', async () => {
  invoke.mockResolvedValue({
    data: { recipe: { ...recipe, ingredients: [] }, warnings: [] },
    error: null,
  });
  const review = jest.fn();
  render(<RecipeImportDialog onClose={jest.fn()} onReview={review} />);
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Recipe text, caption or transcript' }),
    { target: { value: 'unreadable text' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Extract recipe' }));
  expect(
    await screen.findByText('Include between 1 and 100 ingredients.'),
  ).toBeInTheDocument();
  expect(review).not.toHaveBeenCalled();
});

test('shows the safe server error and reference without opening recipe review', async () => {
  const previousResponse = globalThis.Response;
  const message =
    'OpenAI authentication failed. Nothing was saved. Reference: diagnostic-id';
  // jsdom does not supply fetch's Response. Only the interface consumed by
  // this component is needed; no live request is made.
  class ErrorResponse {
    async json() {
      return { error: message, referenceId: 'diagnostic-id' };
    }
  }
  Object.assign(globalThis, { Response: ErrorResponse });
  try {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new ErrorResponse() },
    });
    const review = jest.fn();
    render(<RecipeImportDialog onClose={jest.fn()} onReview={review} />);
    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'Recipe text, caption or transcript',
      }),
      { target: { value: 'Soup: add salt and stir.' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Extract recipe' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(review).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('textbox', {
        name: 'Recipe text, caption or transcript',
      }),
    ).toHaveValue('Soup: add salt and stir.');
  } finally {
    Object.assign(globalThis, { Response: previousResponse });
  }
});
