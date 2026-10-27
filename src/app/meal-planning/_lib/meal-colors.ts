import type { MealType } from './meal-plan';

// Keep meal types recognizable across every portal theme, independently of
// the theme's primary accent. Solid fills keep text contrast predictable.
const mealColors = {
  light: {
    breakfast: { background: '#fff4d6', accent: '#d99a25', text: '#805500' },
    lunch: { background: '#e7f3e9', accent: '#459461', text: '#27603b' },
    dinner: { background: '#e9f0fd', accent: '#5883cf', text: '#315895' },
    snack: { background: '#f3eafa', accent: '#a078c2', text: '#734394' },
  },
  dark: {
    breakfast: { background: '#302719', accent: '#d1a447', text: '#f0c66b' },
    lunch: { background: '#192e25', accent: '#63b58b', text: '#90d2ad' },
    dinner: { background: '#1c2a40', accent: '#719ce1', text: '#a4c4fa' },
    snack: { background: '#2d223b', accent: '#b18bd5', text: '#d1b0ec' },
  },
} as const;

export function getMealColors(type: MealType, mode: 'light' | 'dark') {
  return mealColors[mode][type];
}
