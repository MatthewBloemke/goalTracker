export * from '../../../../supabase/functions/_shared/recipe';

import type { Database } from '@/types';
import type { RecipeDraft } from '../../../../supabase/functions/_shared/recipe';

export type SavedRecipe = Database['public']['Tables']['recipes']['Row'] & {
  recipe_ingredients: Database['public']['Tables']['recipe_ingredients']['Row'][];
  recipe_steps: Database['public']['Tables']['recipe_steps']['Row'][];
};

export function recipeToDraft(recipe: SavedRecipe): RecipeDraft {
  return {
    title: recipe.title,
    servings: recipe.servings,
    sourceUrl: recipe.source_url,
    notes: recipe.notes,
    tags: [...recipe.tags],
    ingredients: [...recipe.recipe_ingredients]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        preparation: item.preparation,
        shoppingQuantity: item.shopping_quantity,
        shoppingUnit: item.shopping_unit,
      })),
    instructions: [...recipe.recipe_steps]
      .sort((a, b) => a.position - b.position)
      .map((step) => step.instruction),
  };
}

export function filterRecipes(
  recipes: SavedRecipe[],
  query: string,
  tag: string,
): SavedRecipe[] {
  const search = query.trim().toLowerCase();
  return recipes.filter(
    (recipe) =>
      (!tag || recipe.tags.includes(tag)) &&
      (!search ||
        [
          recipe.title,
          ...recipe.tags,
          ...recipe.recipe_ingredients.map((item) => item.name),
        ].some((value) => value.toLowerCase().includes(search))),
  );
}
