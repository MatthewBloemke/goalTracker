import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { MealPlanner } from './MealPlanner';
import { MEAL_TYPES, mealLabels, type PlannedMeal } from '../_lib/meal-plan';
import { getMealColors } from '../_lib/meal-colors';

const mockSave = jest.fn().mockResolvedValue(undefined);
const mockRefresh = jest.fn();
const mockRemove = jest.fn();
let mockPlan: {
  meals: PlannedMeal[];
  loading: boolean;
  error: string | null;
  realtimeError: string | null;
};
jest.mock('../_lib/meal-plan', () => ({
  ...jest.requireActual('../_lib/meal-plan'),
  localToday: () => '2026-10-25',
}));
jest.mock('../_hooks/useMealPlan', () => ({
  useMealPlan: () => ({
    ...mockPlan,
    save: mockSave,
    remove: mockRemove,
    refresh: mockRefresh,
  }),
}));
jest.mock('../_hooks/useRecipes', () => ({
  useRecipes: () => ({
    recipes: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));
jest.mock('./ShoppingListDialog', () => ({ ShoppingListDialog: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  mockPlan = { meals: [], loading: false, error: null, realtimeError: null };
});
test('week is the main view; month navigation, date jumps and Today are available', () => {
  render(<MealPlanner familyId="family" familyName="Smiths" />);
  expect(
    screen.getByRole('region', { name: 'Week meal calendar' }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Shared with Smiths')).toHaveTextContent(
    'Smiths',
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Meal plan',
  );
  expect(screen.getAllByRole('button', { name: /Plan meal for/ })).toHaveLength(
    7,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Month' }));
  expect(
    screen.getByRole('heading', { name: 'October 2026' }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /Plan meal for/ })).toHaveLength(
    35,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  expect(
    screen.getByRole('heading', { name: 'November 2026' }),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('Go to date')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Choose date' }));
  fireEvent.change(
    within(screen.getByRole('dialog')).getByLabelText('Go to date'),
    {
      target: { value: '2027-02-20' },
    },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(
    screen.getByRole('heading', { name: 'February 2027' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  expect(
    screen.getByRole('heading', { name: 'October 2026' }),
  ).toBeInTheDocument();
});
test('adding a custom meal from a day saves against that date', async () => {
  render(<MealPlanner familyId="family" familyName="Smiths" />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Plan meal for 2026-10-28' }),
  );
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByLabelText('Date')).toHaveValue('2026-10-28');
  fireEvent.click(dialog.getByRole('button', { name: 'Custom meal' }));
  fireEvent.change(dialog.getByLabelText('Meal name'), {
    target: { value: 'Takeout' },
  });
  fireEvent.click(dialog.getByRole('button', { name: 'Save meal' }));
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Takeout',
        meal_date: '2026-10-28',
        recipe_id: null,
      }),
      undefined,
    ),
  );
  expect(await screen.findByText('Meal saved.')).toBeInTheDocument();
});
test('existing entries open for editing and are ordered within their date', () => {
  mockPlan.meals = [
    {
      id: 'meal',
      meal_date: '2026-10-25',
      meal_type: 'dinner',
      title: 'Leftovers',
      notes: 'Reheat',
      recipe_id: null,
      user_id: 'user',
      family_id: null,
      created_at: '',
      updated_at: '',
    },
  ];
  render(<MealPlanner familyId="family" familyName="Smiths" />);
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Edit Dinner: Leftovers on 2026-10-25',
    }),
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByLabelText('Meal name')).toHaveValue('Leftovers');
  expect(screen.getByLabelText('Meal notes')).toHaveValue('Reheat');
});
test('load failures cannot be mistaken for an empty calendar; refresh remains available', () => {
  mockPlan.error = 'Connection lost';
  render(<MealPlanner familyId="family" familyName="Smiths" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
  expect(
    screen.queryByRole('region', { name: 'Week meal calendar' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Plan a meal' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

test.each(['light', 'dark'] as const)(
  'meal colors and readable labels stay consistent in week, month and the editor (%s)',
  (mode) => {
    mockPlan.meals = MEAL_TYPES.map((type) => ({
      id: type,
      meal_date: '2026-10-25',
      meal_type: type,
      title: `${type} meal`,
      notes: '',
      recipe_id: null,
      user_id: 'user',
      family_id: null,
      created_at: '',
      updated_at: '',
    }));
    render(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <MealPlanner familyId="family" familyName="Smiths" />
      </ThemeProvider>,
    );
    const legend = within(screen.getByRole('list', { name: 'Meal types' }));
    for (const type of MEAL_TYPES)
      expect(legend.getByText(mealLabels[type])).toBeVisible();
    expect(screen.queryByText('Open for ideas')).not.toBeInTheDocument();
    expect(screen.queryByText(/Weeks start on Sunday/)).not.toBeInTheDocument();
    for (const view of ['Week', 'Month']) {
      fireEvent.click(screen.getByRole('button', { name: view }));
      for (const type of MEAL_TYPES) {
        const colors = getMealColors(type, mode);
        const tile = screen.getByRole('button', {
          name: `Edit ${mealLabels[type]}: ${type} meal on 2026-10-25`,
        });
        expect(tile).toHaveStyle({
          backgroundColor: colors.background,
          borderLeftColor: colors.accent,
        });
        expect(within(tile).getByText(mealLabels[type])).toHaveStyle({
          color: colors.text,
        });
      }
    }
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Edit Dinner: dinner meal on 2026-10-25',
      }),
    );
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Meal' }));
    for (const type of MEAL_TYPES) {
      const option = screen.getByRole('option', { name: mealLabels[type] });
      expect(option).toBeVisible();
      expect(option.querySelector('[aria-hidden="true"]')).toHaveStyle({
        backgroundColor: getMealColors(type, mode).accent,
      });
    }
  },
);

test('save feedback disappears automatically without a persistent calendar banner', async () => {
  jest.useFakeTimers();
  try {
    render(<MealPlanner familyId="family" familyName="Smiths" />);
    fireEvent.click(screen.getByRole('button', { name: 'Plan a meal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom meal' }));
    fireEvent.change(screen.getByLabelText('Meal name'), {
      target: { value: 'Soup' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save meal' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Meal saved.');
    act(() => {
      jest.advanceTimersByTime(4500);
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.queryByText('Meal saved.')).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});
