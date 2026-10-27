'use client';

import { useState } from 'react';
import {
  AddRounded,
  CalendarMonthOutlined,
  ChevronLeftRounded,
  ChevronRightRounded,
  NotesRounded,
  RefreshRounded,
} from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  Popover,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
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
  MEAL_TYPES,
  mealLabels,
  mealsOnDate,
  periodLabel,
  shiftPeriod,
  type CalendarView,
  type MealType,
  type PlannedMeal,
} from '../_lib/meal-plan';
import { MealEditor } from './MealEditor';
import { MealTypeLabel } from './MealTypeLabel';
import { getMealColors } from '../_lib/meal-colors';

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
  const [datePicker, setDatePicker] = useState<HTMLButtonElement | null>(null);
  const days = calendarDays(anchor, view);
  const { meals, loading, error, realtimeError, refresh, save, remove } =
    useMealPlan(familyId, days[0], days[days.length - 1]);
  const library = useRecipes(familyId);
  const today = localToday();
  const displayedMeals =
    view === 'month'
      ? meals.filter((meal) => meal.meal_date.startsWith(anchor.slice(0, 7)))
      : meals;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-serif text-3xl">Meal plan</h1>
          <span
            className="rounded-full bg-(--surface-2) px-3 py-1 text-xs text-(--text-secondary)"
            aria-label={
              familyId
                ? `Shared with ${familyName || 'your family'}`
                : 'Personal meal plan'
            }
          >
            {familyId ? familyName || 'Family' : 'Personal'}
          </span>
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
      <section
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        aria-label="Calendar controls"
      >
        <div className="flex min-w-0 items-center gap-1">
          <IconButton
            aria-label={`Previous ${view}`}
            onClick={() => setAnchor(shiftPeriod(anchor, view, -1))}
          >
            <ChevronLeftRounded />
          </IconButton>
          <h2
            className="numeric-value text-center text-sm font-semibold sm:text-lg"
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
          <SecondaryButton
            size="small"
            sx={{
              minWidth: 0,
              px: 1.5,
              py: 0.75,
              ml: 1,
              borderColor: 'divider',
            }}
            onClick={() => setAnchor(localToday())}
          >
            Today
          </SecondaryButton>
        </div>
        <div className="flex items-center gap-2">
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
          <Tooltip title="Go to date">
            <IconButton
              aria-label="Choose date"
              aria-haspopup="dialog"
              aria-expanded={!!datePicker}
              aria-controls={datePicker ? 'meal-calendar-date' : undefined}
              onClick={(event) => setDatePicker(event.currentTarget)}
            >
              <CalendarMonthOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton
              aria-label="Refresh"
              onClick={() => {
                void refresh();
                void library.refresh();
              }}
            >
              <RefreshRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </section>
      <Popover
        open={!!datePicker}
        anchorEl={datePicker}
        onClose={() => setDatePicker(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            id: 'meal-calendar-date',
            role: 'dialog',
            'aria-label': 'Go to date',
            sx: { p: 2 },
          },
        }}
      >
        <AppTextField
          autoFocus
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
        <Button
          onClick={() => setDatePicker(null)}
          sx={{ display: 'block', ml: 'auto', mt: 1, px: 1.5, py: 0.5 }}
        >
          Done
        </Button>
      </Popover>
      {loading ? (
        <div className="p-10 text-center">
          <CircularProgress aria-label="Loading planned meals" />
        </div>
      ) : (
        !error && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <ul
                aria-label="Meal types"
                className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-(--text-secondary)"
              >
                {MEAL_TYPES.map((type) => (
                  <li key={type}>
                    <MealTypeLabel type={type} />
                  </li>
                ))}
              </ul>
              <p className="numeric-value text-xs text-(--text-secondary)">
                {displayedMeals.length
                  ? `${displayedMeals.length} ${displayedMeals.length === 1 ? 'meal' : 'meals'} planned`
                  : 'No meals planned yet'}
              </p>
            </div>
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
                      : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-7'
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
                            : 'min-w-0 min-h-32 rounded-xl border bg-(--surface) p-3 lg:min-h-56'
                        }
                        style={{
                          borderColor:
                            date === today
                              ? 'var(--accent-green)'
                              : 'var(--border)',
                          background: outsideMonth
                            ? 'var(--surface-2)'
                            : undefined,
                        }}
                      >
                        <div className="mb-3 flex items-start justify-between gap-1">
                          <h3
                            className="numeric-value text-sm font-semibold"
                            aria-current={date === today ? 'date' : undefined}
                          >
                            {view === 'week' && (
                              <span className="mb-1 block text-xs font-medium text-(--text-secondary)">
                                {formatMealDate(date, { weekday: 'short' })}
                              </span>
                            )}
                            <span
                              className={
                                date === today ? 'text-(--accent-green)' : ''
                              }
                            >
                              {formatMealDate(
                                date,
                                view === 'month'
                                  ? { month: 'short', day: 'numeric' }
                                  : { day: 'numeric' },
                              )}
                            </span>
                            {date === today && (
                              <span className="sr-only"> (Today)</span>
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
                              sx={(theme) => {
                                const colors = getMealColors(
                                  meal.meal_type as MealType,
                                  theme.palette.mode,
                                );
                                return {
                                  display: 'block',
                                  minWidth: 0,
                                  textAlign: 'left',
                                  whiteSpace: 'normal',
                                  overflowWrap: 'anywhere',
                                  bgcolor: colors.background,
                                  borderColor: 'transparent',
                                  borderLeft: `3px solid ${colors.accent}`,
                                  color: 'text.primary',
                                  '&:hover': {
                                    bgcolor: colors.background,
                                    borderColor: colors.accent,
                                    transform: 'none',
                                  },
                                  '&.Mui-focusVisible': {
                                    outline: `2px solid ${colors.text}`,
                                    outlineOffset: 2,
                                  },
                                  '& .meal-type': { color: colors.text },
                                  px: 1,
                                  py: 0.75,
                                };
                              }}
                            >
                              <span className="meal-type block text-[10px] font-semibold uppercase tracking-wide">
                                {mealLabels[meal.meal_type as MealType]}
                              </span>
                              <span className="block text-sm leading-snug">
                                {meal.title}
                                {meal.notes && (
                                  <NotesRounded
                                    aria-label="Has notes"
                                    sx={{
                                      fontSize: 14,
                                      ml: 0.5,
                                      verticalAlign: 'middle',
                                      opacity: 0.6,
                                    }}
                                  />
                                )}
                              </span>
                            </Button>
                          ))}
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
      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setNotice('');
        }}
      >
        <Alert severity="success" role="status" onClose={() => setNotice('')}>
          {notice}
        </Alert>
      </Snackbar>
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
