import { getContrastRatio } from '@mui/material/styles';
import { portalThemes } from '@/lib/portal-themes';
import { MEAL_TYPES } from './meal-plan';
import { getMealColors } from './meal-colors';

test.each(portalThemes)(
  'meal labels and titles have readable contrast in $name',
  (theme) => {
    const colors = MEAL_TYPES.map((type) => getMealColors(type, theme.mode));
    expect(new Set(colors.map((color) => color.accent)).size).toBe(
      MEAL_TYPES.length,
    );
    for (const color of colors) {
      expect(
        getContrastRatio(color.background, color.text),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(color.background, theme.colors.textPrimary),
      ).toBeGreaterThanOrEqual(4.5);
    }
  },
);
