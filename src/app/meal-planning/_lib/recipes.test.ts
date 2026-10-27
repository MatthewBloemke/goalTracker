/** @jest-environment node */
import {
  emptyIngredient,
  emptyRecipe,
  filterRecipes,
  formatRecipeQuantity,
  ingredientLabel,
  normalizeTags,
  parseRecipeFile,
  parseRecipeQuantity,
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
  [null, ''],
  [1, '1'],
  [250, '250'],
  [0.5, '½'],
  [0.25, '¼'],
  [0.75, '¾'],
  [1.5, '1½'],
  [2.25, '2¼'],
  [1 / 3, '⅓'],
  [0.333, '⅓'],
  [0.3333, '⅓'],
  [0.667, '⅔'],
  [1.6667, '1⅔'],
  [0.125, '⅛'],
  [0.375, '⅜'],
  [0.625, '⅝'],
  [0.875, '⅞'],
  [0.0625, '1/16'],
  [1.1875, '1 3/16'],
  [1 / 12, '1/12'],
  [0.1, '⅒'],
  [0.2, '⅕'],
  [0.4, '⅖'],
  [0.6, '⅗'],
  [0.8, '⅘'],
  [1 / 6, '⅙'],
  [5 / 6, '⅚'],
  [1 / 7, '⅐'],
  [1 / 9, '⅑'],
  [0.47, '0.47'],
  [0.0001, '0.0001'],
  [1.9999, '1.9999'],
  [0, '0'],
  [-1, '-1'],
  [NaN, 'NaN'],
  [Infinity, 'Infinity'],
])(
  'formats cooking quantity %s as %s without guessing unusual measures',
  (value, label) => {
    expect(formatRecipeQuantity(value as number | null)).toBe(label);
  },
);

test.each([
  ['', null],
  ['  ', null],
  ['1', 1],
  ['250', 250],
  ['1/2', 0.5],
  [' 1 / 4 ', 0.25],
  ['1 1/2', 1.5],
  ['2 3/4', 2.75],
  ['½', 0.5],
  ['1½', 1.5],
  ['1 ½', 1.5],
  ['⅓', 1 / 3],
  ['1⅔', 1 + 2 / 3],
  ['3/2', 1.5],
  ['1⁄8', 0.125],
  ['2 1/16', 2.0625],
  ['0.5', 0.5],
  ['.25', 0.25],
  ['1.', 1],
  ['0.0001', 0.0001],
])('parses entered quantity %s as a numeric value', (input, value) => {
  expect(parseRecipeQuantity(input as string)).toBe(value);
});

test.each([
  '1/',
  '1/0',
  '1 0/0',
  '0',
  '-1/2',
  '1-2',
  '1 1/2 extra',
  '½¾',
  'one',
  '1e2',
  'Infinity',
  'NaN',
  '100001',
  '100000 1/2',
  '1.2.3',
  '1/2/3',
])('rejects invalid quantity text %s', (input) => {
  expect(() => parseRecipeQuantity(input)).toThrow('positive quantity');
});

test('fraction display does not change recipe storage, exported numbers or shopping amounts', () => {
  const recipe = {
    ...draft,
    ingredients: [
      { ...draft.ingredients[0], quantity: 1.5, shoppingQuantity: 2 },
    ],
  };
  expect(ingredientLabel(recipe.ingredients[0])).toBe('1½ tsp paprika');
  expect(ingredientLabel(recipe.ingredients[0], true)).toBe(
    '2 container paprika',
  );
  const exported = serializeRecipe(recipe);
  expect(parseRecipeFile(exported).ingredients[0].quantity).toBe(1.5);
  expect(JSON.parse(exported).recipe.ingredients[0].quantity).toBe(1.5);
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
