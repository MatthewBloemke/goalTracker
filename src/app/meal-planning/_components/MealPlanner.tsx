'use client';

import { useState } from 'react';
import {
  AddRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
  RefreshRounded,
} from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { useMealPlan } from '../_hooks/useMealPlan';
import { useRecipes } from '../_hooks/useRecipes';
import {
  calendarDays,
  formatMealDate,
  isMealDate,
  localToday,
  mealLabels,
  mealsOnDate,
  periodLabel,
  shiftPeriod,
  type CalendarView,
  type MealType,
  type PlannedMeal,
} from '../_lib/meal-plan';
import { MealEditor } from './MealEditor';

export function MealPlanner({
  familyId,
  familyName,
}: {
  familyId: string | null;
  familyName?: string;
}) {
  const [anchor, setAnchor] = useState(localToday);
  const [view, setView] = useState<CalendarView>('week');
  const [editor, setEditor] = useState<{
    date: string;
    existing?: PlannedMeal;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const days = calendarDays(anchor, view);
  const { meals, loading, error, realtimeError, refresh, save, remove } =
    useMealPlan(familyId, days[0], days[days.length - 1]);
  const library = useRecipes(familyId);
  const today = localToday();
  const displayedMeals =
    view === 'month'
      ? meals.filter((meal) => meal.meal_date.startsWith(anchor.slice(0, 7)))
      : meals;
  const plannedDays = new Set(displayedMeals.map((meal) => meal.meal_date))
    .size;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-(--text-secondary)">
            Meal Planning
          </p>
          <h1 className="mt-1 font-serif text-3xl">What’s on the menu?</h1>
          <p className="mt-2 text-sm text-(--text-secondary)">
            {familyName
              ? `${familyName}’s shared meal plan`
              : 'Your personal meal plan'}{' '}
            · Make room for favorites and easy nights.
          </p>
        </div>
        <PrimaryButton
          startIcon={<AddRounded />}
          disabled={loading || !!error}
          onClick={() =>
            setEditor({ date: days.includes(today) ? today : anchor })
          }
        >
          Plan a meal
        </PrimaryButton>
      </header>
      {error && (
        <Alert severity="error">Unable to load the meal plan: {error}</Alert>
      )}
      {realtimeError && <Alert severity="warning">{realtimeError}</Alert>}
      {notice && (
        <Alert severity="success" onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}
      <section
        className="glass flex flex-col gap-4 rounded-2xl p-4"
        aria-label="Calendar controls"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <IconButton
              aria-label={`Previous ${view}`}
              onClick={() => setAnchor(shiftPeriod(anchor, view, -1))}
            >
              <ChevronLeftRounded />
            </IconButton>
            <h2
              className="numeric-value text-base font-semibold sm:text-lg"
              aria-live="polite"
            >
              {periodLabel(anchor, view)}
            </h2>
            <IconButton
              aria-label={`Next ${view}`}
              onClick={() => setAnchor(shiftPeriod(anchor, view, 1))}
            >
              <ChevronRightRounded />
            </IconButton>
          </div>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            aria-label="Calendar view"
            onChange={(_, value: CalendarView | null) => {
              if (value) setView(value);
            }}
          >
            <ToggleButton value="week">Week</ToggleButton>
            <ToggleButton value="month">Month</ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SecondaryButton onClick={() => setAnchor(localToday())}>
            Today
          </SecondaryButton>
          <AppTextField
            label="Go to date"
            type="date"
            value={anchor}
            sx={{ width: 190 }}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: '1000-01-01', max: '9999-12-31' },
            }}
            onChange={(e) => {
              if (isMealDate(e.target.value)) setAnchor(e.target.value);
            }}
          />
          <SecondaryButton
            startIcon={<RefreshRounded />}
            onClick={() => {
              void refresh();
              void library.refresh();
            }}
          >
            Refresh
          </SecondaryButton>
          {!loading && !error && (
            <p className="ml-auto text-sm text-(--text-secondary)">
              <span className="numeric-value font-semibold">
                {displayedMeals.length}
              </span>{' '}
              meals ·{' '}
              <span className="numeric-value font-semibold">{plannedDays}</span>{' '}
              days planned
            </p>
          )}
        </div>
      </section>
      {loading ? (
        <div className="p-10 text-center">
          <CircularProgress aria-label="Loading planned meals" />
        </div>
      ) : (
        !error && (
          <>
            {!displayedMeals.length && (
              <Alert severity="info">
                Nothing planned for this {view} yet. Add a saved recipe, or a
                custom meal like leftovers or takeout.
              </Alert>
            )}
            <p className="text-xs text-(--text-secondary)">
              {view === 'month'
                ? 'Select a meal to view or edit it. On small screens, swipe the calendar sideways.'
                : 'Select a meal to open its recipe, add notes, or move it to another day.'}{' '}
              Weeks start on Sunday.
            </p>
            <div
              className={
                view === 'month'
                  ? 'overflow-x-auto rounded-2xl border border-(--border)'
                  : ''
              }
              tabIndex={view === 'month' ? 0 : undefined}
              role="region"
              aria-label={`${view === 'month' ? 'Month' : 'Week'} meal calendar`}
            >
              <div className={view === 'month' ? 'min-w-[770px]' : ''}>
                <div
                  className={
                    view === 'month'
                      ? 'grid grid-cols-7 bg-(--surface-2)'
                      : 'hidden'
                  }
                  aria-hidden="true"
                >
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                    (day) => (
                      <div
                        key={day}
                        className="p-3 text-center text-xs font-semibold text-(--text-secondary)"
                      >
                        {day}
                      </div>
                    ),
                  )}
                </div>
                <div
                  className={
                    view === 'month'
                      ? 'grid grid-cols-7'
                      : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'
                  }
                >
                  {days.map((date) => {
                    const entries = mealsOnDate(meals, date);
                    const outsideMonth =
                      view === 'month' &&
                      date.slice(0, 7) !== anchor.slice(0, 7);
                    return (
                      <section
                        key={date}
                        aria-label={formatMealDate(date, {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        className={
                          view === 'month'
                            ? 'min-h-36 border-t border-r border-(--border) p-2'
                            : 'glass min-h-44 rounded-2xl p-4'
                        }
                        style={{
                          background:
                            date === today
                              ? 'var(--accent-green-glow)'
                              : outsideMonth
                                ? 'var(--surface-2)'
                                : undefined,
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between gap-1">
                          <h3
                            className="numeric-value text-sm font-semibold"
                            aria-current={date === today ? 'date' : undefined}
                          >
                            {formatMealDate(
                              date,
                              view === 'month'
                                ? { month: 'short', day: 'numeric' }
                                : {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  },
                            )}
                            {date === today && (
                              <span className="ml-1 text-xs text-(--accent-green)">
                                Today
                              </span>
                            )}
                          </h3>
                          <IconButton
                            size="small"
                            aria-label={`Plan meal for ${date}`}
                            onClick={() => setEditor({ date })}
                          >
                            <AddRounded fontSize="small" />
                          </IconButton>
                        </div>
                        <div className="flex flex-col gap-2">
                          {entries.map((meal) => (
                            <Button
                              key={meal.id}
                              variant="outlined"
                              color="inherit"
                              aria-label={`Edit ${mealLabels[meal.meal_type as MealType]}: ${meal.title} on ${date}`}
                              onClick={() =>
                                setEditor({ date, existing: meal })
                              }
                              sx={{
                                display: 'block',
                                minWidth: 0,
                                textAlign: 'left',
                                whiteSpace: 'normal',
                                overflowWrap: 'anywhere',
                                px: 1,
                                py: 0.75,
                              }}
                            >
                              <span className="block text-[10px] font-semibold uppercase tracking-wide text-(--text-secondary)">
                                {mealLabels[meal.meal_type as MealType]}
                              </span>
                              <span className="block text-sm leading-snug">
                                {meal.title}
                              </span>
                              {meal.notes && (
                                <span className="block text-xs text-(--text-secondary)">
                                  Has notes
                                </span>
                              )}
                            </Button>
                          ))}
                          {!entries.length && (
                            <p className="py-2 text-xs text-(--text-secondary)">
                              Open for ideas
                            </p>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )
      )}
      {editor && (
        <MealEditor
          date={editor.date}
          existing={editor.existing}
          recipes={library.recipes}
          recipesLoading={library.loading}
          recipesError={library.error}
          onClose={() => setEditor(null)}
          onSave={async (draft) => {
            await save(draft, editor.existing);
            setNotice('Meal saved.');
          }}
          onRemove={async () => {
            if (editor.existing) {
              await remove(editor.existing);
              setNotice('Meal removed from the plan.');
            }
          }}
        />
      )}
    </div>
  );
}
