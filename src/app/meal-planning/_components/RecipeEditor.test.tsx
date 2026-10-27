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

test('imported decimals display as fractions without changing unedited stored precision', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  render(
    <RecipeEditor
      title="Review imported recipe"
      initial={{
        ...recipe,
        ingredients: [0.5, 1.25, 0.333].map((quantity) => ({
          ...recipe.ingredients[0],
          quantity,
        })),
      }}
      onClose={jest.fn()}
      onSave={save}
    />,
  );
  const quantities = screen.getAllByRole('textbox', { name: 'Quantity' });
  expect(quantities[0]).toHaveValue('½');
  expect(quantities[1]).toHaveValue('1¼');
  expect(quantities[2]).toHaveValue('⅓');
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(
    save.mock.calls[0][0].ingredients.map(
      (item: { quantity: number }) => item.quantity,
    ),
  ).toEqual([0.5, 1.25, 0.333]);
  expect(save.mock.calls[0][0].ingredients[0]).not.toHaveProperty(
    'quantityText',
  );
});

test.each([
  ['1/2', 0.5],
  ['1 1/2', 1.5],
  ['2¼', 2.25],
  ['0.75', 0.75],
  ['', null],
])('quantity input %s saves numerically', async (input, value) => {
  const save = jest.fn().mockResolvedValue(undefined);
  render(
    <RecipeEditor
      title="Edit recipe"
      initial={recipe}
      onClose={jest.fn()}
      onSave={save}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Quantity' }), {
    target: { value: input },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: [expect.objectContaining({ quantity: value })],
      }),
    ),
  );
});

test('partial/invalid fractions remain editable and cannot be saved until corrected', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  render(
    <RecipeEditor
      title="Edit recipe"
      initial={recipe}
      onClose={jest.fn()}
      onSave={save}
    />,
  );
  const input = screen.getByRole('textbox', { name: 'Quantity' });
  fireEvent.change(input, { target: { value: '1/' } });
  expect(input).toHaveValue('1/');
  fireEvent.change(input, { target: { value: '1/0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ingredient 1: use a positive quantity',
  );
  expect(save).not.toHaveBeenCalled();
  expect(input).toHaveValue('1/0');
  fireEvent.change(input, { target: { value: '1/4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: [expect.objectContaining({ quantity: 0.25 })],
      }),
    ),
  );
});

test('fraction drafts remain attached to the right ingredient when rows are added or removed', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  render(
    <RecipeEditor
      title="Edit recipe"
      initial={recipe}
      onClose={jest.fn()}
      onSave={save}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Quantity' }), {
    target: { value: '1/2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add ingredient' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Ingredient 2' }), {
    target: { value: 'pepper' },
  });
  fireEvent.change(screen.getAllByRole('textbox', { name: 'Quantity' })[1], {
    target: { value: '1/8' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Remove ingredient 1' }));
  expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveValue('1/8');
  fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: [
          expect.objectContaining({ name: 'pepper', quantity: 0.125 }),
        ],
      }),
    ),
  );
});
