import {
  addDays,
  calendarDays,
  formatMealDate,
  isMealDate,
  localToday,
  mealsOnDate,
  periodLabel,
  shiftPeriod,
  validateMealDraft,
  type MealDraft,
  type PlannedMeal,
} from './meal-plan';

const draft: MealDraft = {
  meal_date: '2026-10-25',
  meal_type: 'dinner',
  title: ' Soup ',
  notes: ' Prep early ',
  recipe_id: null,
};
test('today is based on local date fields, not UTC serialization', () => {
  expect(localToday(new Date(2026, 9, 25, 23, 30))).toBe('2026-10-25');
  expect(isMealDate(localToday())).toBe(true);
});
test.each([
  '2026-02-29',
  '2026-04-31',
  '2026-13-01',
  '2026-00-01',
  '2026-10-00',
  '2026-1-2',
  '2026-10-25T12:00:00Z',
  '',
  '0001-01-01',
])('rejects invalid date %s', (value) => expect(isMealDate(value)).toBe(false));
test.each([
  '2024-02-29',
  '2026-03-08',
  '2026-11-01',
  '1000-01-01',
  '9999-12-31',
])('accepts calendar date %s', (value) => expect(isMealDate(value)).toBe(true));
test('date arithmetic crosses DST, leap days and year boundaries without skips', () => {
  expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(() => addDays('not-a-date', 1)).toThrow('valid calendar date');
});
test('weeks always run Sunday through Saturday, including across years', () => {
  expect(calendarDays('2026-10-28', 'week')).toEqual([
    '2026-10-25',
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
  ]);
  expect(calendarDays('2026-01-01', 'week')[0]).toBe('2025-12-28');
  expect(periodLabel('2026-01-01', 'week')).toBe('Dec 28, 2025 – Jan 3, 2026');
});
test('month calendars include boundary days and four, five or six complete weeks', () => {
  expect(calendarDays('2026-02-15', 'month')).toHaveLength(28);
  const october = calendarDays('2026-10-25', 'month');
  expect(october).toHaveLength(35);
  expect(october[0]).toBe('2026-09-27');
  expect(october.at(-1)).toBe('2026-10-31');
  expect(calendarDays('2026-08-31', 'month')).toHaveLength(42);
  expect(calendarDays('2024-02-29', 'month')).toContain('2024-02-29');
  expect(calendarDays('1000-01-01', 'month').every(isMealDate)).toBe(true);
  expect(calendarDays('9999-12-31', 'month').every(isMealDate)).toBe(true);
});
test('period navigation does not overflow from January 31 into March', () => {
  expect(shiftPeriod('2026-01-31', 'month', 1)).toBe('2026-02-01');
  expect(shiftPeriod('2026-01-15', 'month', -1)).toBe('2025-12-01');
  expect(shiftPeriod('2026-10-25', 'week', 1)).toBe('2026-11-01');
  expect(shiftPeriod('9999-12-31', 'week', 1)).toBe('9999-12-31');
  expect(shiftPeriod('9999-12-31', 'month', 1)).toBe('9999-12-31');
  expect(periodLabel('2026-10-25', 'month')).toBe('October 2026');
  expect(formatMealDate('2026-10-25', { weekday: 'long' })).toBe('Sunday');
});
test('validates and trims editable fields without leaking ownership or revision into a write', () => {
  expect(
    validateMealDraft({
      ...draft,
      id: 'ignored',
      family_id: 'ignored',
    } as MealDraft),
  ).toEqual({ ...draft, title: 'Soup', notes: 'Prep early' });
  const id = '00000000-0000-4000-8000-000000000001';
  expect(validateMealDraft({ ...draft, recipe_id: id }).recipe_id).toBe(id);
});
test.each([
  [{ meal_date: '2026-02-29' }, 'valid calendar date'],
  [{ meal_type: 'unknown' }, 'meal type'],
  [{ title: ' ' }, 'meal name'],
  [{ title: 'x'.repeat(161) }, 'meal name'],
  [{ notes: 'x'.repeat(4001) }, '4,000'],
  [{ recipe_id: 'foreign-or-invalid' }, 'saved recipe'],
])('rejects invalid meal edits %#', (changes, message) => {
  expect(() => validateMealDraft({ ...draft, ...changes })).toThrow(
    message as string,
  );
});
test('orders breakfast/lunch/dinner/snacks with stable tie-breaking without mutating the input', () => {
  const entry = (
    id: string,
    type: string,
    date = draft.meal_date,
    created = '2026-10-20',
  ) =>
    ({
      ...draft,
      meal_date: date,
      meal_type: type,
      id,
      created_at: created,
    }) as PlannedMeal;
  const meals = [
    entry('d', 'snack'),
    entry('c', 'dinner'),
    entry('b', 'lunch'),
    entry('a', 'breakfast'),
    entry('e', 'lunch', draft.meal_date, '2026-10-21'),
    entry('f', 'lunch'),
    entry('other', 'breakfast', '2026-11-01'),
  ];
  expect(mealsOnDate(meals, draft.meal_date).map((meal) => meal.id)).toEqual([
    'a',
    'b',
    'f',
    'e',
    'c',
    'd',
  ]);
  expect(meals[0].id).toBe('d');
});
