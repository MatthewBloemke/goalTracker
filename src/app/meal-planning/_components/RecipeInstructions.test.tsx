import { render, screen } from '@testing-library/react';
import { RecipeInstructions } from './RecipeInstructions';
import { emptyIngredient, emptyRecipe } from '../_lib/recipes';

test('saved recipe and meal-plan instructions show kitchen fractions, not stored decimals', () => {
  render(
    <RecipeInstructions
      recipe={{
        ...emptyRecipe(),
        ingredients: [
          { ...emptyIngredient(), name: 'milk', quantity: 0.5, unit: 'cup' },
          { ...emptyIngredient(), name: 'flour', quantity: 1.25, unit: 'cups' },
          { ...emptyIngredient(), name: 'salt', preparation: 'to taste' },
        ],
        instructions: ['Mix together.'],
      }}
    />,
  );
  expect(screen.getByText('½ cup milk')).toBeVisible();
  expect(screen.getByText('1¼ cups flour')).toBeVisible();
  expect(screen.getByText('salt to taste')).toBeVisible();
  expect(screen.getByText('Mix together.')).toBeVisible();
});
