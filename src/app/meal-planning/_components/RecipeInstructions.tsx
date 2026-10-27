import { ingredientLabel, type RecipeDraft } from '../_lib/recipes';

export function RecipeInstructions({ recipe }: { recipe: RecipeDraft }) {
  return (
    <div className="grid gap-6 sm:grid-cols-[1fr_1.5fr]">
      <section>
        <h3 className="mb-3 font-semibold">Ingredients</h3>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          {recipe.ingredients.map((item, index) => (
            <li key={index}>{ingredientLabel(item)}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-3 font-semibold">Instructions</h3>
        <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm leading-6">
          {recipe.instructions.map((step, index) => (
            <li key={index} className="whitespace-pre-wrap pl-1">
              {step}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
