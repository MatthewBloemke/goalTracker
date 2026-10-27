import { Box } from '@mui/material';
import { mealLabels, type MealType } from '../_lib/meal-plan';
import { getMealColors } from '../_lib/meal-colors';

export function MealTypeLabel({ type }: { type: MealType }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Box
        component="span"
        aria-hidden="true"
        sx={(theme) => ({
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: getMealColors(type, theme.palette.mode).accent,
        })}
      />
      {mealLabels[type]}
    </span>
  );
}
