'use client';

import { SectionNav } from '@/components/ui/SectionNav';

const links = [
  { href: '/meal-planning', label: 'Meal plan' },
  { href: '/meal-planning/recipes', label: 'Recipes' },
];

export function MealPlanningNav() {
  return (
    <div className="mb-6">
      <SectionNav
        label="Meal Planning"
        ariaLabel="Meal planning sections"
        links={links}
      />
    </div>
  );
}
