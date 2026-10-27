'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tab, Tabs } from '@mui/material';

export function MealPlanningNav() {
  const pathname = usePathname();
  return (
    <Tabs
      value={pathname.startsWith('/meal-planning/recipes') ? 'recipes' : 'plan'}
      aria-label="Meal planning sections"
      sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
    >
      <Tab
        component={Link}
        href="/meal-planning"
        value="plan"
        label="Meal plan"
      />
      <Tab
        component={Link}
        href="/meal-planning/recipes"
        value="recipes"
        label="Recipes"
      />
    </Tabs>
  );
}
