// Portable contract shared by the browser, AI importer and recipe-file format.
// No database IDs or ownership are accepted from a shared file.
export interface RecipeIngredient {
  name: string;
  quantity: number | null;
  unit: string;
  preparation: string;
  shoppingQuantity: number;
  shoppingUnit: string;
}

export interface RecipeDraft {
  title: string;
  servings: number | null;
  sourceUrl: string;
  notes: string;
  tags: string[];
  ingredients: RecipeIngredient[];
  instructions: string[];
}

export const RECIPE_FILE_MAX_BYTES = 100_000;
export const RECIPE_TEXT_MAX_LENGTH = 16_000;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(
  value: unknown,
  label: string,
  max: number,
  required = false,
): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  ) {
    throw new Error(
      `${label} must be ${required ? 'nonempty text' : 'text'} of at most ${max} characters.`,
    );
  }
  return value.trim();
}

function quantity(
  value: unknown,
  label: string,
  nullable = false,
): number | null {
  if (nullable && value === null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 100_000
  ) {
    throw new Error(`${label} must be a positive number (at most 100,000).`);
  }
  return value;
}

export function safeSourceUrl(value: unknown): string {
  const source = text(value, 'Source URL', 2048);
  if (!source) return '';
  try {
    const url = new URL(source);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error();
    return url.href;
  } catch {
    throw new Error(
      'Source must be an http or https URL without embedded credentials.',
    );
  }
}

export function normalizeTags(tags: string[]): string[] {
  return [
    ...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
  ];
}

export function validateRecipe(value: unknown): RecipeDraft {
  if (!isRecord(value)) throw new Error('Recipe must be an object.');
  if (!Array.isArray(value.tags) || value.tags.length > 20)
    throw new Error('Use at most 20 tags.');
  if (
    !Array.isArray(value.ingredients) ||
    value.ingredients.length < 1 ||
    value.ingredients.length > 100
  ) {
    throw new Error('Include between 1 and 100 ingredients.');
  }
  if (
    !Array.isArray(value.instructions) ||
    value.instructions.length < 1 ||
    value.instructions.length > 100
  ) {
    throw new Error('Include between 1 and 100 instruction steps.');
  }
  const recipe: RecipeDraft = {
    title: text(value.title, 'Recipe title', 160, true),
    servings: quantity(value.servings, 'Servings', true),
    sourceUrl: safeSourceUrl(value.sourceUrl),
    notes: text(value.notes, 'Notes', 4000),
    tags: normalizeTags(value.tags.map((tag) => text(tag, 'Tag', 40, true))),
    ingredients: value.ingredients.map((item, i) => {
      if (!isRecord(item)) throw new Error(`Ingredient ${i + 1} is invalid.`);
      return {
        name: text(item.name, `Ingredient ${i + 1} name`, 160, true),
        quantity: quantity(item.quantity, `Ingredient ${i + 1} quantity`, true),
        unit: text(item.unit, 'Cooking unit', 40),
        preparation: text(item.preparation, 'Preparation', 300),
        shoppingQuantity: quantity(item.shoppingQuantity, 'Shopping quantity')!,
        shoppingUnit: text(item.shoppingUnit, 'Shopping unit', 40, true),
      };
    }),
    instructions: value.instructions.map((step) =>
      text(step, 'Instruction', 2000, true),
    ),
  };
  // Leave room for the versioned file envelope and pretty-printing, ensuring
  // every valid saved recipe can also be shared/imported without truncation.
  if (new TextEncoder().encode(JSON.stringify(recipe, null, 2)).length > 90_000)
    throw new Error('Recipe is too large. Shorten the notes or instructions.');
  return recipe;
}

export function serializeRecipe(recipe: RecipeDraft): string {
  return JSON.stringify(
    {
      format: 'family-portal-recipe',
      version: 1,
      recipe: validateRecipe(recipe),
    },
    null,
    2,
  );
}

export function parseRecipeFile(contents: string): RecipeDraft {
  if (new TextEncoder().encode(contents).length > RECIPE_FILE_MAX_BYTES)
    throw new Error('Recipe files must be under 100 KB.');
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error('This is not a valid recipe JSON file.');
  }
  if (
    !isRecord(value) ||
    value.format !== 'family-portal-recipe' ||
    value.version !== 1
  ) {
    throw new Error(
      'Unsupported recipe file. Choose a Family Portal recipe export (version 1).',
    );
  }
  return validateRecipe(value.recipe);
}

export function ingredientLabel(
  ingredient: RecipeIngredient,
  shopping = false,
): string {
  const amount = shopping ? ingredient.shoppingQuantity : ingredient.quantity;
  const unit = shopping ? ingredient.shoppingUnit : ingredient.unit;
  return [amount, unit, ingredient.name, !shopping && ingredient.preparation]
    .filter((part) => part !== null && part !== false && part !== '')
    .join(' ');
}

export function emptyIngredient(): RecipeIngredient {
  return {
    name: '',
    quantity: null,
    unit: '',
    preparation: '',
    shoppingQuantity: 1,
    shoppingUnit: 'container',
  };
}

export function emptyRecipe(): RecipeDraft {
  return {
    title: '',
    servings: null,
    sourceUrl: '',
    notes: '',
    tags: [],
    ingredients: [emptyIngredient()],
    instructions: [''],
  };
}
