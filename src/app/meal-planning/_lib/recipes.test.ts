/** @jest-environment node */
import {
  emptyIngredient,
  emptyRecipe,
  filterRecipes,
  ingredientLabel,
  normalizeTags,
  parseRecipeFile,
  recipeToDraft,
  safeSourceUrl,
  serializeRecipe,
  validateRecipe,
  type RecipeDraft,
  type SavedRecipe,
} from './recipes';

const draft: RecipeDraft = {
  title: 'Paprika chicken',
  servings: 4,
  sourceUrl: 'https://example.com/chicken',
  notes: '',
  tags: ['Weeknight', 'chicken', ' CHICKEN '],
  ingredients: [
    {
      name: 'paprika',
      quantity: 1,
      unit: 'tsp',
      preparation: '',
      shoppingQuantity: 1,
      shoppingUnit: 'container',
    },
  ],
  instructions: ['Season the chicken.', 'Bake until cooked.'],
};
const saved: SavedRecipe = {
  id: 'recipe-id',
  user_id: 'user',
  family_id: 'family',
  title: draft.title,
  servings: 4,
  source_url: draft.sourceUrl,
  notes: '',
  tags: ['weeknight', 'chicken'],
  created_at: '',
  updated_at: '',
  recipe_ingredients: [
    {
      id: 'ingredient',
      recipe_id: 'recipe-id',
      position: 0,
      name: 'paprika',
      quantity: 1,
      unit: 'tsp',
      preparation: '',
      shopping_quantity: 1,
      shopping_unit: 'container',
    },
  ],
  recipe_steps: [
    {
      id: 'second',
      recipe_id: 'recipe-id',
      position: 1,
      instruction: 'Bake until cooked.',
    },
    {
      id: 'first',
      recipe_id: 'recipe-id',
      position: 0,
      instruction: 'Season the chicken.',
    },
  ],
};

test('sharing round-trips a portable normalized recipe without ownership/IDs', () => {
  const exported = serializeRecipe(recipeToDraft(saved));
  expect(parseRecipeFile(exported)).toEqual({
    ...draft,
    tags: ['weeknight', 'chicken'],
  });
  expect(exported).not.toMatch(/user_id|family_id|recipe-id|ingredient_id/);
  expect(JSON.parse(exported)).toMatchObject({
    version: 1,
    format: 'family-portal-recipe',
  });
});

test('untrusted extra properties cannot import someone else’s IDs or owner', () => {
  const malicious = {
    ...draft,
    id: 'existing-recipe',
    user_id: 'victim',
    family_id: 'victim-family',
  };
  expect(validateRecipe(malicious)).not.toHaveProperty('family_id');
  expect(validateRecipe(malicious)).not.toHaveProperty('id');
});

test.each([
  null,
  {},
  { ...draft, title: '' },
  { ...draft, servings: -1 },
  { ...draft, servings: Infinity },
  { ...draft, tags: Array(21).fill('tag') },
  { ...draft, tags: ['x'.repeat(41)] },
  { ...draft, ingredients: [] },
  { ...draft, instructions: [] },
  { ...draft, ingredients: [null] },
  { ...draft, instructions: [123] },
  { ...draft, ingredients: [{ ...draft.ingredients[0], shoppingQuantity: 0 }] },
  { ...draft, ingredients: [{ ...draft.ingredients[0], quantity: '1' }] },
])('rejects invalid recipe input %#', (value) => {
  expect(() => validateRecipe(value)).toThrow();
});

test('bounds both per-field and total recipe size', () => {
  expect(() => validateRecipe({ ...draft, notes: 'x'.repeat(4001) })).toThrow(
    'Notes',
  );
  expect(() =>
    validateRecipe({
      ...draft,
      instructions: Array(100).fill('x'.repeat(1000)),
    }),
  ).toThrow('too large');
  expect(() => parseRecipeFile('x'.repeat(100001))).toThrow('100 KB');
});

test('missing cooking quantities remain unknown; purchasing amount stays separate', () => {
  const item = {
    ...draft.ingredients[0],
    quantity: null,
    unit: '',
    preparation: 'to taste',
  };
  expect(
    validateRecipe({ ...draft, servings: null, ingredients: [item] }).servings,
  ).toBeNull();
  expect(ingredientLabel(item)).toBe('paprika to taste');
  expect(ingredientLabel(draft.ingredients[0])).toBe('1 tsp paprika');
  expect(ingredientLabel(item, true)).toBe('1 container paprika');
  expect(emptyIngredient()).toMatchObject({
    quantity: null,
    shoppingQuantity: 1,
  });
  expect(emptyRecipe().instructions).toEqual(['']);
});

test.each([
  '{',
  JSON.stringify({ version: 2, recipe: draft }),
  JSON.stringify({ format: 'wrong', version: 1, recipe: draft }),
  'null',
])('rejects malformed or unsupported shared files', (value) => {
  expect(() => parseRecipeFile(value)).toThrow();
});

test.each([
  'javascript:alert(1)',
  'data:text/html,test',
  'https://user:secret@example.com',
  'not a url',
])('rejects unsafe source links %s', (value) => {
  expect(() => safeSourceUrl(value)).toThrow();
});

test('normalizes tags and safe links and supports search by ingredient, title and tag', () => {
  expect(normalizeTags([' A ', '', 'a', 'B'])).toEqual(['a', 'b']);
  expect(safeSourceUrl('')).toBe('');
  expect(safeSourceUrl(' https://example.com ')).toBe('https://example.com/');
  expect(filterRecipes([saved], 'PAPRIKA', 'weeknight')).toEqual([saved]);
  expect(filterRecipes([saved], '', '')).toEqual([saved]);
  expect(filterRecipes([saved], 'weeknight', '')).toEqual([saved]);
  expect(filterRecipes([saved], '', 'vegetarian')).toEqual([]);
  expect(filterRecipes([saved], 'pasta', '')).toEqual([]);
  expect(recipeToDraft(saved).instructions).toEqual(draft.instructions);
  expect(saved.recipe_steps[0].position).toBe(1); // Conversion never mutates data.
});
