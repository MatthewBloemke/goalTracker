import type { Database } from '@/types';

export type PlannedMeal =
  Database['public']['Tables']['meal_plan_entries']['Row'];
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export type CalendarView = 'week' | 'month';
export type MealDraft = Pick<
  PlannedMeal,
  'meal_date' | 'meal_type' | 'title' | 'notes' | 'recipe_id'
>;
export const mealLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

// Calendar dates are not instants: do arithmetic in UTC, but derive "today"
// from the user's local calendar. DST must never skip/repeat a planning day.
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function isMealDate(value: string): boolean {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function calendarDate(value: string): Date {
  if (!isMealDate(value)) throw new Error('Choose a valid calendar date.');
  return new Date(`${value}T12:00:00Z`);
}
export function addDays(value: string, days: number): string {
  const date = calendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function calendarDays(anchor: string, view: CalendarView): string[] {
  const date = calendarDate(anchor);
  const first = view === 'week' ? anchor : `${anchor.slice(0, 7)}-01`;
  const start = calendarDate(first);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  let count = 7;
  if (view === 'month') {
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12),
    );
    count =
      Math.ceil((calendarDate(first).getUTCDay() + last.getUTCDate()) / 7) * 7;
  }
  // Boundary years cannot contain selectable dates outside the supported range.
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  }).filter(isMealDate);
}
export function shiftPeriod(
  anchor: string,
  view: CalendarView,
  direction: number,
): string {
  if (view === 'week') {
    const next = addDays(anchor, direction * 7);
    return isMealDate(next) ? next : anchor;
  }
  const date = calendarDate(anchor);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + direction);
  const next = date.toISOString().slice(0, 10);
  return isMealDate(next) ? next : anchor;
}
export function formatMealDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: 'UTC',
  }).format(calendarDate(value));
}
export function periodLabel(anchor: string, view: CalendarView): string {
  if (view === 'month')
    return formatMealDate(anchor, { month: 'long', year: 'numeric' });
  const days = calendarDays(anchor, view);
  const options = { month: 'short', day: 'numeric', year: 'numeric' } as const;
  return `${formatMealDate(days[0], options)} – ${formatMealDate(days[days.length - 1], options)}`;
}
export function mealsOnDate(meals: PlannedMeal[], date: string): PlannedMeal[] {
  return meals
    .filter((meal) => meal.meal_date === date)
    .sort(
      (a, b) =>
        MEAL_TYPES.indexOf(a.meal_type as MealType) -
          MEAL_TYPES.indexOf(b.meal_type as MealType) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
}
export function validateMealDraft(draft: MealDraft): MealDraft {
  if (!isMealDate(draft.meal_date))
    throw new Error('Choose a valid calendar date.');
  if (!MEAL_TYPES.includes(draft.meal_type as MealType))
    throw new Error('Choose a meal type.');
  const title = draft.title.trim();
  if (!title || title.length > 160)
    throw new Error('Enter a meal name of 1–160 characters.');
  if (draft.notes.length > 4000)
    throw new Error('Keep meal notes under 4,000 characters.');
  if (
    draft.recipe_id !== null &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      draft.recipe_id,
    )
  ) {
    throw new Error('Choose a saved recipe or a custom meal.');
  }
  return {
    meal_date: draft.meal_date,
    meal_type: draft.meal_type,
    title,
    notes: draft.notes.trim(),
    recipe_id: draft.recipe_id,
  };
}
