import { fireEvent, render, screen, within } from '@testing-library/react';
import { MealPlanningNav } from './MealPlanningNav';

let mockPathname = '/meal-planning';
let mockDesktop = false;
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: () => mockDesktop,
}));

test.each([
  ['/meal-planning', 'Meal plan'],
  ['/meal-planning/recipes', 'Recipes'],
  ['/meal-planning/recipes/some-recipe', 'Recipes'],
])(
  'mobile meal section picker reflects %s and keeps both destinations',
  (path, label) => {
    mockDesktop = false;
    mockPathname = path;
    render(<MealPlanningNav />);
    fireEvent.click(
      screen.getByRole('button', { name: `Meal Planning section: ${label}` }),
    );
    const menu = within(screen.getByRole('menu'));
    expect(menu.getAllByRole('menuitem')).toHaveLength(2);
    expect(menu.getByRole('menuitem', { name: label })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(menu.getByRole('menuitem', { name: 'Recipes' })).toHaveAttribute(
      'href',
      '/meal-planning/recipes',
    );
  },
);

test('desktop meal planning retains its tabs', () => {
  mockDesktop = true;
  mockPathname = '/meal-planning/recipes';
  render(<MealPlanningNav />);
  expect(
    screen.getByRole('tab', { name: 'Recipes', hidden: true }),
  ).toHaveAttribute('aria-selected', 'true');
  expect(
    screen.queryByRole('button', { name: /Meal Planning section/ }),
  ).not.toBeInTheDocument();
});
