import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TextEncoder } from 'node:util';
import { RecipeEditor } from './RecipeEditor';
import { emptyRecipe, type RecipeDraft } from '../_lib/recipes';

Object.assign(globalThis, { TextEncoder });

const recipe: RecipeDraft = {
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
  instructions: ['Boil water.', 'Add salt.'],
};

test('an imported draft is never saved until confirmation; fields and step order remain editable', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  render(
    <RecipeEditor
      title="Review imported recipe"
      initial={recipe}
      warnings={['Verify cooking time.']}
      onClose={jest.fn()}
      onSave={save}
    />,
  );
  expect(screen.getByText('Verify cooking time.')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Recipe name' }), {
    target: { value: 'Family soup' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Tags' }), {
    target: { value: 'Quick, quick, Lunch' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Move step 2 up' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Family soup',
        tags: ['quick', 'lunch'],
        instructions: ['Add salt.', 'Boil water.'],
      }),
    ),
  );
});

test('shopping defaults stay out of normal recipe view but can be edited without changing cooking amounts', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  render(
    <RecipeEditor
      title="Edit recipe"
      initial={recipe}
      onClose={jest.fn()}
      onSave={save}
    />,
  );
  expect(
    screen.queryByRole('spinbutton', { name: 'Buy quantity 1' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Shopping quantities (advanced)' }),
  );
  const input = await screen.findByRole('spinbutton', {
    name: 'Buy quantity 1',
  });
  fireEvent.change(input, { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: [
          expect.objectContaining({
            quantity: 1,
            unit: 'tsp',
            shoppingQuantity: 2,
            shoppingUnit: 'container',
          }),
        ],
      }),
    ),
  );
});

test('save failures keep the editable draft and show the server error', async () => {
  const save = jest
    .fn()
    .mockRejectedValue(new Error('This recipe changed since you opened it.'));
  const close = jest.fn();
  render(
    <RecipeEditor
      title="Edit recipe"
      initial={recipe}
      onClose={close}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
  expect(
    await screen.findByText('This recipe changed since you opened it.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Recipe name' })).toHaveValue(
    'Soup',
  );
  expect(close).not.toHaveBeenCalled();
});
