'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import {
  AddRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
  ExpandMoreRounded,
  EditOutlined,
  ReceiptLongOutlined,
} from '@mui/icons-material';
import {
  useBudget,
  type CreateTransactionInput,
} from '@/app/budget/_hooks/useBudget';
import { useReceiptScanner } from '@/app/budget/_hooks/useReceiptScanner';
import { useFamily } from '@/hooks/useFamily';
import {
  shiftBudgetMonth,
  toBudgetMonth,
  validateTransactionSplits,
} from '@/app/budget/_lib/budget';
import {
  RECEIPT_IMAGE_TYPES,
  receiptAnalysisToTransactionDraft,
  type ReceiptAnalysis,
} from '@/app/budget/_lib/receipt';
import { formatCurrency } from '@/app/budget/_lib/snowball';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type {
  BudgetCategory,
  BudgetGroup,
  BudgetTransactionSplit,
} from '@/types';

type CategoryValueView = 'planned' | 'spent' | 'remaining';

const CATEGORY_VALUE_LABELS: Record<CategoryValueView, string> = {
  planned: 'Planned',
  spent: 'Spent',
  remaining: 'Remaining',
};

export default function MonthlyBudgetPage() {
  const { family, loading: familyLoading } = useFamily();
  const [month, setMonth] = useState(() => toBudgetMonth(new Date()));
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroups, setEditingGroups] = useState(false);
  const [categoryValueView, setCategoryValueView] =
    useState<CategoryValueView>('planned');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [receiptAnchor, setReceiptAnchor] = useState<HTMLButtonElement | null>(
    null,
  );
  const budgetData = useBudget({ familyId: family?.id, month });
  const {
    budget,
    previousBudget,
    summary,
    groups,
    categories,
    transactions,
    splits,
    loading,
    mutating,
    error,
    realtimeConnected,
  } = budgetData;
  const receiptScanner = useReceiptScanner({
    familyId: family?.id,
    categories,
  });

  if (familyLoading || loading) return <BudgetLoading />;
  if (!family) return null;
  const allCollapsed =
    groups.length > 0 && groups.every(({ id }) => collapsedGroups.has(id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl text-(--text-primary)">
              Monthly Plan
            </h1>
            <span className="rounded-full bg-(--surface-2) px-3 py-1 text-xs text-(--text-secondary)">
              {family.name}
            </span>
            <span
              className="flex items-center gap-1.5 text-xs text-(--text-secondary)"
              title={
                realtimeConnected
                  ? 'Live family updates connected'
                  : 'Connecting to family updates'
              }
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: realtimeConnected
                    ? 'var(--accent-green)'
                    : 'var(--accent-amber)',
                }}
              />
              <span className={realtimeConnected ? 'sr-only' : ''}>
                {realtimeConnected ? 'Live updates connected' : 'Connecting'}
              </span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton
            startIcon={<ReceiptLongOutlined />}
            endIcon={<ExpandMoreRounded />}
            disabled={categories.length === 0 || receiptScanner.analyzing}
            aria-haspopup="dialog"
            aria-expanded={!!receiptAnchor}
            onClick={(event) => setReceiptAnchor(event.currentTarget)}
          >
            Receipt
          </SecondaryButton>
          <PrimaryButton
            startIcon={<AddRounded />}
            onClick={() => {
              receiptScanner.reset();
              setShowTransactionForm(true);
            }}
            disabled={categories.length === 0}
          >
            Add transaction
          </PrimaryButton>
        </div>
      </div>

      <Popover
        open={!!receiptAnchor}
        anchorEl={receiptAnchor}
        onClose={() => setReceiptAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': 'Receipt options',
            sx: { p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 },
          },
        }}
      >
        {[true, false].map((capture) => (
          <ReceiptImageButton
            key={String(capture)}
            label={capture ? 'Scan receipt' : 'Upload receipt'}
            capture={capture}
            onSelect={(file) => {
              setReceiptAnchor(null);
              setShowTransactionForm(true);
              void receiptScanner.analyze(file);
            }}
          />
        ))}
      </Popover>

      <MonthNavigator month={month} onChange={setMonth} />

      {error && (
        <div className="rounded-xl border border-(--accent-red) bg-(--surface) px-4 py-3 text-sm text-(--accent-red)">
          {error}
        </div>
      )}

      {!budget ? (
        <EmptyMonth
          month={month}
          previousMonth={previousBudget?.month ?? null}
          disabled={mutating}
          onCreate={() => void budgetData.createBudget()}
          onCopy={() => void budgetData.copyPreviousMonth()}
        />
      ) : (
        <>
          <BudgetSummary
            summary={summary}
            income={budget.income}
            disabled={mutating}
            onIncomeSave={budgetData.updateIncome}
          />
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-(--text-primary)">
                Categories
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {groups.length > 0 && (
                  <Button
                    color="inherit"
                    size="small"
                    sx={{ px: 1, py: 0.5, color: 'text.secondary' }}
                    onClick={() =>
                      setCollapsedGroups(
                        allCollapsed
                          ? new Set()
                          : new Set(groups.map(({ id }) => id)),
                      )
                    }
                  >
                    {allCollapsed ? 'Expand all' : 'Collapse all'}
                  </Button>
                )}
                {editingGroups && (
                  <SecondaryButton
                    size="small"
                    sx={{ px: 1.5, py: 0.5 }}
                    disabled={mutating}
                    startIcon={<AddRounded />}
                    onClick={() => setShowGroupForm(true)}
                  >
                    Add group
                  </SecondaryButton>
                )}
                <Button
                  color="inherit"
                  size="small"
                  aria-pressed={editingGroups}
                  sx={{ px: 1, py: 0.5 }}
                  onClick={() => {
                    if (!editingGroups) setCollapsedGroups(new Set());
                    setEditingGroups(!editingGroups);
                  }}
                >
                  {editingGroups ? 'Done editing' : 'Edit groups'}
                </Button>
              </div>
            </div>

            {summary.groups.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-(--text-primary)">No budget groups yet</p>
                <p className="mt-1 text-sm text-(--text-secondary)">
                  Add a group such as Food, Home, or Fun, then create categories
                  inside it.
                </p>
                <SecondaryButton
                  sx={{ mt: 2 }}
                  onClick={() => setShowGroupForm(true)}
                >
                  Add your first group
                </SecondaryButton>
              </div>
            ) : (
              <div className="rounded-xl border border-(--border) bg-(--surface)">
                <div className="border-b border-(--border) px-2 sm:px-4">
                  <Tabs
                    value={categoryValueView}
                    onChange={(_event, nextView: CategoryValueView) =>
                      setCategoryValueView(nextView)
                    }
                    aria-label="Category amount view"
                    variant="fullWidth"
                    sx={{
                      minHeight: 52,
                      '& .MuiTab-root': {
                        minHeight: 52,
                        fontSize: '1rem',
                        fontWeight: 600,
                        textTransform: 'none',
                      },
                    }}
                  >
                    <Tab value="planned" label="Planned" />
                    <Tab value="spent" label="Spent" />
                    <Tab value="remaining" label="Remaining" />
                  </Tabs>
                </div>
                {summary.groups.map((groupSnapshot) => (
                  <BudgetGroupCard
                    key={groupSnapshot.group.id}
                    snapshot={groupSnapshot}
                    disabled={mutating}
                    editing={editingGroups}
                    valueView={categoryValueView}
                    collapsed={collapsedGroups.has(groupSnapshot.group.id)}
                    onToggle={() =>
                      setCollapsedGroups((current) => {
                        const next = new Set(current);
                        if (next.has(groupSnapshot.group.id))
                          next.delete(groupSnapshot.group.id);
                        else next.add(groupSnapshot.group.id);
                        return next;
                      })
                    }
                    onAllocationChange={budgetData.updateAllocation}
                    onAddCategory={budgetData.createCategory}
                    onDeleteCategory={budgetData.archiveCategory}
                    onDeleteGroup={budgetData.archiveGroup}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <TransactionList
        transactions={transactions}
        splits={splits}
        categories={categories}
        onDelete={budgetData.deleteTransaction}
      />

      <TransactionDialog
        key={`${month}:${showTransactionForm}`}
        open={showTransactionForm}
        month={month}
        groups={groups}
        categories={categories}
        disabled={mutating}
        receiptAnalysis={receiptScanner.analysis}
        receiptError={receiptScanner.error}
        analyzingReceipt={receiptScanner.analyzing}
        onAnalyzeReceipt={(file) => void receiptScanner.analyze(file)}
        onClose={() => {
          receiptScanner.reset();
          setShowTransactionForm(false);
        }}
        onSave={async (input) => {
          const success = await budgetData.createTransaction(input);
          if (success) setShowTransactionForm(false);
        }}
      />
      <NewGroupDialog
        open={showGroupForm}
        disabled={mutating}
        onClose={() => setShowGroupForm(false)}
        onSave={async (name) => {
          const success = await budgetData.createGroup(name);
          if (success) setShowGroupForm(false);
        }}
      />
    </div>
  );
}

function MonthNavigator({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="group"
      aria-label="Budget month"
    >
      <IconButton
        aria-label="Previous month"
        onClick={() => onChange(shiftBudgetMonth(month, -1))}
        color="inherit"
      >
        <ChevronLeftRounded />
      </IconButton>
      <div className="text-center">
        <p
          className="numeric-value px-2 text-lg font-medium text-(--text-primary)"
          aria-live="polite"
        >
          {dayjs(month).format('MMMM YYYY')}
        </p>
      </div>
      <IconButton
        aria-label="Next month"
        onClick={() => onChange(shiftBudgetMonth(month, 1))}
        color="inherit"
      >
        <ChevronRightRounded />
      </IconButton>
      {month !== toBudgetMonth(new Date()) && (
        <Button
          size="small"
          onClick={() => onChange(toBudgetMonth(new Date()))}
          sx={{
            color: 'var(--accent-green)',
            fontSize: '0.75rem',
            minWidth: 0,
            px: 1,
            py: 0.5,
          }}
        >
          This month
        </Button>
      )}
    </div>
  );
}

function EmptyMonth({
  month,
  previousMonth,
  disabled,
  onCreate,
  onCopy,
}: {
  month: string;
  previousMonth: string | null;
  disabled: boolean;
  onCreate: () => void;
  onCopy: () => void;
}) {
  return (
    <section className="glass rounded-3xl px-6 py-14 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-(--accent-green-glow) text-2xl text-(--accent-green)">
        $
      </span>
      <h2 className="mt-5 font-serif text-2xl text-(--text-primary)">
        Plan {dayjs(month).format('MMMM')}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-(--text-secondary)">
        This month is intentionally blank. Start fresh, or copy your latest plan
        and carry its unused category surplus forward.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {previousMonth && (
          <PrimaryButton disabled={disabled} onClick={onCopy}>
            Copy {dayjs(previousMonth).format('MMMM')} plan
          </PrimaryButton>
        )}
        <SecondaryButton disabled={disabled} onClick={onCreate}>
          Start blank month
        </SecondaryButton>
      </div>
    </section>
  );
}

function BudgetSummary({
  summary,
  income,
  disabled,
  onIncomeSave,
}: {
  summary: ReturnType<
    typeof import('@/app/budget/_lib/budget').calculateMonthlyBudget
  >;
  income: number;
  disabled: boolean;
  onIncomeSave: (income: number) => Promise<boolean>;
}) {
  return (
    <section
      aria-label="Budget overview"
      className="grid gap-5 rounded-xl border border-(--border) bg-(--surface) p-5 lg:grid-cols-[1fr_2fr] lg:items-center"
    >
      <BudgetStatus unassigned={summary.unassigned} status={summary.status} />
      <div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          <SummaryCard label="Monthly income">
            <IncomeEditor
              key={income}
              income={income}
              disabled={disabled}
              onSave={onIncomeSave}
            />
          </SummaryCard>
          <SummaryCard
            label="Assigned"
            value={formatCurrency(summary.assigned)}
          />
          <SummaryCard
            label="Spent so far"
            value={formatCurrency(summary.spent)}
          />
        </div>
        {summary.rollover > 0 && (
          <p className="numeric-value mt-3 text-xs text-(--text-secondary)">
            +{formatCurrency(summary.rollover)} carried over from last month
          </p>
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-(--text-secondary)">{label}</p>
      {children ?? (
        <p className="numeric-value mt-1 text-xl font-medium text-(--text-primary)">
          {value}
        </p>
      )}
    </div>
  );
}

function IncomeEditor({
  income,
  disabled,
  onSave,
}: {
  income: number;
  disabled: boolean;
  onSave: (income: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState(String(income));
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const cancelled = useRef(false);

  if (!editing)
    return (
      <Button
        color="inherit"
        aria-label={`Edit monthly income, ${formatCurrency(income)}`}
        disabled={disabled}
        onClick={() => {
          cancelled.current = false;
          setValue(String(income));
          setEditing(true);
        }}
        endIcon={
          <EditOutlined sx={{ fontSize: '16px !important', opacity: 0.55 }} />
        }
        sx={{
          p: 0,
          mt: 0.5,
          minWidth: 0,
          fontSize: '1.25rem',
          fontVariantNumeric: 'tabular-nums',
          '&:hover': { transform: 'none' },
        }}
      >
        {formatCurrency(income)}
      </Button>
    );

  return (
    <div className="mt-1">
      <AppTextField
        autoFocus
        variant="standard"
        type="number"
        value={value}
        disabled={disabled}
        error={invalid}
        helperText={invalid ? 'Enter zero or a positive income.' : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          setInvalid(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
          if (event.key === 'Escape') {
            cancelled.current = true;
            setInvalid(false);
            setEditing(false);
          }
        }}
        onBlur={async () => {
          if (cancelled.current) return;
          const next = Number(value);
          if (!value.trim() || !Number.isFinite(next) || next < 0) {
            setInvalid(true);
            return;
          }
          if (next !== income && !(await onSave(next))) return;
          setEditing(false);
        }}
        slotProps={{
          htmlInput: { 'aria-label': 'Monthly income', min: 0, step: '0.01' },
          input: {
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          },
        }}
        sx={{
          '& .MuiInput-root::before, & .MuiInput-root::after': {
            display: 'none',
          },
          '& .MuiInputBase-root': {
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans), sans-serif',
            fontSize: '1.25rem',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 500,
            lineHeight: 1.25,
          },
          '& .MuiInputBase-input': {
            font: 'inherit',
            fontVariantNumeric: 'inherit',
            p: 0,
          },
          '& .MuiInputAdornment-root': {
            color: 'var(--text-primary)',
            font: 'inherit',
            mr: 0.25,
          },
          '& .MuiInputAdornment-root .MuiTypography-root': {
            color: 'inherit',
            font: 'inherit',
          },
        }}
      />
    </div>
  );
}

function BudgetStatus({
  unassigned,
  status,
}: {
  unassigned: number;
  status: 'balanced' | 'under-planned' | 'over-planned';
}) {
  const content =
    status === 'balanced'
      ? {
          title: 'Fully assigned',
          color: 'var(--accent-green)',
        }
      : status === 'under-planned'
        ? {
            title: 'Left to assign',
            color: 'var(--accent-amber)',
          }
        : {
            title: 'Over-assigned',
            color: 'var(--accent-red)',
          };

  return (
    <div
      role="status"
      aria-label="Budget balance"
      className="border-l-4 pl-4"
      style={{ borderColor: content.color }}
    >
      <p className="text-sm font-medium" style={{ color: content.color }}>
        {content.title}
      </p>
      <p className="numeric-value mt-1 text-3xl font-semibold text-(--text-primary)">
        {formatCurrency(Math.abs(unassigned))}
      </p>
    </div>
  );
}

function BudgetGroupCard({
  snapshot,
  disabled,
  editing,
  valueView,
  collapsed,
  onToggle,
  onAllocationChange,
  onAddCategory,
  onDeleteCategory,
  onDeleteGroup,
}: {
  snapshot: ReturnType<
    typeof import('@/app/budget/_lib/budget').calculateMonthlyBudget
  >['groups'][number];
  disabled: boolean;
  editing: boolean;
  valueView: CategoryValueView;
  collapsed: boolean;
  onToggle: () => void;
  onAllocationChange: (categoryId: string, amount: number) => Promise<boolean>;
  onAddCategory: (groupId: string, name: string) => Promise<boolean>;
  onDeleteCategory: (categoryId: string) => Promise<boolean>;
  onDeleteGroup: (groupId: string) => Promise<boolean>;
}) {
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const { group } = snapshot;

  return (
    <article
      aria-label={`${group.name} group`}
      className="border-b border-(--border) last:border-b-0"
    >
      <h3>
        <ButtonBase
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.name} group`}
          aria-expanded={!collapsed}
          aria-controls={`budget-group-${group.id}`}
          onClick={onToggle}
          className="grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3"
          sx={{
            display: 'grid',
            width: '100%',
            px: 2,
            py: 1.5,
            textAlign: 'left',
            bgcolor: 'action.hover',
            '&.Mui-focusVisible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: -2,
            },
          }}
        >
          <span className="flex min-w-0 items-center gap-2 text-base font-semibold">
            <ExpandMoreRounded
              fontSize="small"
              sx={{
                transform: collapsed ? 'rotate(-90deg)' : undefined,
                color: 'text.secondary',
              }}
            />
            <span className="truncate">{group.name}</span>
          </span>
          <span
            className="numeric-value text-right text-base font-semibold"
            aria-label={`${group.name} ${CATEGORY_VALUE_LABELS[valueView].toLowerCase()} total`}
            style={{
              color:
                valueView === 'remaining' && snapshot.remaining < 0
                  ? 'var(--accent-red)'
                  : 'var(--text-secondary)',
            }}
          >
            {formatCurrency(snapshot[valueView])}
          </span>
        </ButtonBase>
      </h3>
      <div id={`budget-group-${group.id}`} hidden={collapsed}>
        <div>
          {snapshot.categories.map((categorySnapshot) => (
            <CategoryRow
              key={`${categorySnapshot.category.id}:${categorySnapshot.planned}`}
              snapshot={categorySnapshot}
              disabled={disabled}
              editing={editing}
              valueView={valueView}
              onAllocationChange={onAllocationChange}
              onDelete={onDeleteCategory}
            />
          ))}
        </div>
        {snapshot.categories.length === 0 && (
          <p className="px-4 py-3 text-sm text-(--text-secondary)">
            No categories yet. Use Edit groups to add one.
          </p>
        )}
        {editing && group.is_system && (
          <p className="px-4 py-3 text-xs text-(--text-secondary)">
            Debt categories are synced from Manage Debts.
          </p>
        )}
        {editing && !group.is_system && (
          <footer className="border-t border-(--border) px-4 py-3">
            {addingCategory ? (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const success = await onAddCategory(group.id, categoryName);
                  if (success) {
                    setCategoryName('');
                    setAddingCategory(false);
                  }
                }}
              >
                <AppTextField
                  autoFocus
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder="Category name"
                  slotProps={{ htmlInput: { 'aria-label': 'Category name' } }}
                  sx={{ flex: 1 }}
                />
                <PrimaryButton
                  type="submit"
                  size="small"
                  disabled={disabled || !categoryName.trim()}
                  sx={{ minWidth: 64, px: 2 }}
                >
                  Add
                </PrimaryButton>
                <SecondaryButton
                  size="small"
                  onClick={() => setAddingCategory(false)}
                  sx={{ minWidth: 72, px: 2 }}
                >
                  Cancel
                </SecondaryButton>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <Button
                  disabled={disabled}
                  onClick={() => setAddingCategory(true)}
                  sx={{ color: 'var(--accent-green)', minWidth: 0, p: 0 }}
                >
                  + Add category
                </Button>
                <Button
                  disabled={disabled}
                  color="error"
                  size="small"
                  aria-label={`Remove ${group.name} group`}
                  onClick={() => void onDeleteGroup(group.id)}
                  sx={{ minWidth: 0, px: 1 }}
                >
                  Remove group
                </Button>
              </div>
            )}
          </footer>
        )}
      </div>
    </article>
  );
}

function CategoryRow({
  snapshot,
  disabled,
  editing,
  valueView,
  onAllocationChange,
  onDelete,
}: {
  snapshot: ReturnType<
    typeof import('@/app/budget/_lib/budget').calculateMonthlyBudget
  >['groups'][number]['categories'][number];
  disabled: boolean;
  editing: boolean;
  valueView: CategoryValueView;
  onAllocationChange: (categoryId: string, amount: number) => Promise<boolean>;
  onDelete: (categoryId: string) => Promise<boolean>;
}) {
  const [planned, setPlanned] = useState(String(snapshot.planned));
  const progress =
    snapshot.available > 0
      ? Math.min(100, (snapshot.spent / snapshot.available) * 100)
      : snapshot.spent > 0
        ? 100
        : 0;
  const progressColor =
    snapshot.spent > snapshot.available
      ? 'var(--accent-red)'
      : progress >= 80
        ? 'var(--accent-amber)'
        : 'var(--accent-green)';

  return (
    <div
      role="group"
      aria-label={`${snapshot.category.name} category`}
      className="grid grid-cols-[minmax(0,1fr)_minmax(120px,auto)] items-center gap-x-4 gap-y-3 border-t border-(--border) px-4 py-4 sm:px-5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-medium text-(--text-primary) sm:text-lg">
            {snapshot.category.name}
          </p>
          {snapshot.paidThisMonth && (
            <span className="rounded-full bg-(--accent-green-glow) px-2 py-0.5 text-[0.65rem] text-(--accent-green)">
              Paid this month
            </span>
          )}
        </div>
        {snapshot.rollover > 0 && (
          <p className="numeric-value mt-0.5 text-xs text-(--accent-green)">
            +{formatCurrency(snapshot.rollover)} from last month
          </p>
        )}
        {editing && !snapshot.category.is_system && (
          <Button
            color="error"
            size="small"
            disabled={disabled}
            aria-label={`Remove ${snapshot.category.name} category`}
            onClick={() => void onDelete(snapshot.category.id)}
            sx={{ fontSize: '0.75rem', minWidth: 0, p: 0, mt: 0.5 }}
          >
            Remove
          </Button>
        )}
      </div>
      {valueView === 'planned' ? (
        <AppTextField
          className="numeric-value"
          type="number"
          disabled={disabled}
          value={planned}
          onChange={(event) => setPlanned(event.target.value)}
          onBlur={() => {
            const next = Number(planned);
            if (Number.isFinite(next) && next >= 0 && next !== snapshot.planned)
              void onAllocationChange(snapshot.category.id, next);
          }}
          slotProps={{
            htmlInput: {
              'aria-label': `${snapshot.category.name} planned amount`,
              min: 0,
              step: '0.01',
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">$</InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'transparent',
              '& fieldset': { borderColor: 'transparent' },
              '&:hover fieldset': { borderColor: 'divider' },
            },
            '& .MuiInputBase-input': {
              fontSize: '1.125rem',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
              py: 1,
            },
          }}
        />
      ) : (
        <span
          className="numeric-value inline-block py-2 text-right text-lg font-semibold"
          aria-label={`${snapshot.category.name} ${CATEGORY_VALUE_LABELS[valueView].toLowerCase()} amount`}
          style={{
            color:
              valueView === 'remaining' && snapshot.remaining < 0
                ? 'var(--accent-red)'
                : valueView === 'spent'
                  ? 'var(--text-secondary)'
                  : 'var(--text-primary)',
          }}
        >
          {formatCurrency(snapshot[valueView])}
        </span>
      )}
      <LinearProgress
        variant="determinate"
        value={progress}
        aria-label={`${snapshot.category.name} spending progress`}
        aria-valuetext={`${formatCurrency(snapshot.spent)} spent of ${formatCurrency(snapshot.available)} available`}
        sx={{
          gridColumn: '1 / -1',
          height: 8,
          borderRadius: 999,
          bgcolor: 'var(--surface-2)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 999,
            bgcolor: progressColor,
          },
        }}
      />
    </div>
  );
}

function TransactionList({
  transactions,
  splits,
  categories,
  onDelete,
}: {
  transactions: Array<{
    id: string;
    amount: number;
    occurred_on: string;
    merchant: string;
    source: string;
  }>;
  splits: BudgetTransactionSplit[];
  categories: BudgetCategory[];
  onDelete: (transactionId: string) => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState(false);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const splitsByTransaction = useMemo(() => {
    const map = new Map<string, BudgetTransactionSplit[]>();
    for (const split of splits)
      map.set(split.transaction_id, [
        ...(map.get(split.transaction_id) ?? []),
        split,
      ]);
    return map;
  }, [splits]);

  return (
    <section className="overflow-hidden rounded-xl border border-(--border) bg-(--surface)">
      <h2>
        <ButtonBase
          aria-expanded={expanded}
          aria-controls="budget-transactions"
          onClick={() => setExpanded(!expanded)}
          sx={{
            width: '100%',
            justifyContent: 'space-between',
            p: 2,
            '&.Mui-focusVisible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: -2,
            },
          }}
        >
          <span className="text-sm font-semibold">
            Transactions{' '}
            <span className="numeric-value ml-2 font-normal text-(--text-secondary)">
              {transactions.length}
            </span>
          </span>
          <ExpandMoreRounded
            sx={{
              transform: expanded ? 'rotate(180deg)' : undefined,
              color: 'text.secondary',
            }}
          />
        </ButtonBase>
      </h2>
      <div
        id="budget-transactions"
        hidden={!expanded}
        className="border-t border-(--border)"
      >
        {transactions.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-(--text-secondary)">
            No transactions in this month yet.
          </p>
        ) : (
          <div className="divide-y divide-(--border)">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-start gap-4 px-4 py-3"
              >
                <div className="w-12 shrink-0 text-center">
                  <p className="text-xs uppercase text-(--text-secondary)">
                    {dayjs(transaction.occurred_on).format('MMM')}
                  </p>
                  <p className="numeric-value text-lg font-medium text-(--text-primary)">
                    {dayjs(transaction.occurred_on).format('D')}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-(--text-primary)">
                      {transaction.merchant}
                    </p>
                    {transaction.source === 'debt_payment' && (
                      <span className="rounded-full bg-(--accent-green-glow) px-2 py-0.5 text-[0.65rem] text-(--accent-green)">
                        Debt payment
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-(--text-secondary)">
                    {(splitsByTransaction.get(transaction.id) ?? [])
                      .map(
                        (split) =>
                          categoryById.get(split.category_id)?.name ??
                          'Archived category',
                      )
                      .join(' · ')}
                  </p>
                </div>
                <p className="numeric-value text-lg font-medium text-(--text-primary)">
                  -{formatCurrency(transaction.amount)}
                </p>
                {transaction.source !== 'debt_payment' && (
                  <IconButton
                    size="small"
                    aria-label={`Delete transaction at ${transaction.merchant}`}
                    onClick={() => void onDelete(transaction.id)}
                    sx={{
                      color: 'var(--text-secondary)',
                      '&:hover': { color: 'var(--accent-red)' },
                    }}
                  >
                    ×
                  </IconButton>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TransactionDialog({
  open,
  month,
  groups,
  categories,
  disabled,
  receiptAnalysis,
  receiptError,
  analyzingReceipt,
  onAnalyzeReceipt,
  onClose,
  onSave,
}: {
  open: boolean;
  month: string;
  groups: BudgetGroup[];
  categories: BudgetCategory[];
  disabled: boolean;
  receiptAnalysis: ReceiptAnalysis | null;
  receiptError: string | null;
  analyzingReceipt: boolean;
  onAnalyzeReceipt: (file: File) => void;
  onClose: () => void;
  onSave: (input: CreateTransactionInput) => Promise<void>;
}) {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() =>
    month === toBudgetMonth(new Date()) ? dayjs().format('YYYY-MM-DD') : month,
  );
  const [note, setNote] = useState('');
  const [transactionSplits, setTransactionSplits] = useState<
    Array<{ categoryId: string; amount: string }>
  >([{ categoryId: '', amount: '' }]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const appliedReceiptAnalysis = useRef<ReceiptAnalysis | null>(null);
  const groupById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );

  useEffect(() => {
    if (!receiptAnalysis || appliedReceiptAnalysis.current === receiptAnalysis)
      return;
    appliedReceiptAnalysis.current = receiptAnalysis;
    const draft = receiptAnalysisToTransactionDraft(
      receiptAnalysis,
      date,
      new Set(categories.map(({ id }) => id)),
    );
    setMerchant(draft.merchant);
    setAmount(draft.amount);
    setDate(draft.date);
    setTransactionSplits(draft.splits);
    setValidationError(null);
  }, [categories, date, receiptAnalysis]);

  const close = () => {
    setMerchant('');
    setAmount('');
    setNote('');
    setTransactionSplits([{ categoryId: '', amount: '' }]);
    setValidationError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Add transaction</DialogTitle>
      <DialogContent>
        <form
          className="mt-2 flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const numericAmount = Number(amount);
            const parsedSplits = transactionSplits.map((split) => ({
              categoryId: split.categoryId,
              amount: Number(split.amount),
            }));
            const splitError = validateTransactionSplits(
              numericAmount,
              parsedSplits,
            );
            if (!merchant.trim()) {
              setValidationError('Place or merchant is required.');
              return;
            }
            if (splitError) {
              setValidationError(splitError);
              return;
            }
            setValidationError(null);
            await onSave({
              amount: numericAmount,
              occurredOn: date,
              merchant: merchant.trim(),
              note: note.trim(),
              splits: parsedSplits,
            });
          }}
        >
          <div className="rounded-xl border border-(--border) bg-(--surface) p-3">
            <p className="text-sm font-medium text-(--text-primary)">
              Prefill from a receipt
            </p>
            <p className="mt-1 text-xs text-(--text-secondary)">
              The image is processed temporarily and is not saved with the
              transaction.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ReceiptImageButton
                label="Scan with camera"
                capture
                disabled={analyzingReceipt}
                onSelect={onAnalyzeReceipt}
              />
              <ReceiptImageButton
                label="Choose image"
                disabled={analyzingReceipt}
                onSelect={onAnalyzeReceipt}
              />
            </div>
          </div>

          {analyzingReceipt && (
            <Alert severity="info" icon={<CircularProgress size={18} />}>
              Reading the receipt and matching it to your budget categories…
            </Alert>
          )}
          {receiptError && <Alert severity="error">{receiptError}</Alert>}
          {receiptAnalysis && !analyzingReceipt && (
            <ReceiptReviewNotice analysis={receiptAnalysis} />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Place / merchant">
              <AppTextField
                required
                value={merchant}
                onChange={(event) => setMerchant(event.target.value)}
                placeholder="Grocery store"
                slotProps={{ htmlInput: { 'aria-label': 'Place or merchant' } }}
              />
            </Field>
            <Field label="Total amount">
              <AppTextField
                required
                type="number"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  if (transactionSplits.length === 1)
                    setTransactionSplits([
                      { ...transactionSplits[0], amount: event.target.value },
                    ]);
                }}
                placeholder="0.00"
                slotProps={{
                  htmlInput: {
                    'aria-label': 'Total amount',
                    min: 0.01,
                    step: '0.01',
                  },
                }}
              />
            </Field>
            <Field label="Date">
              <AppTextField
                required
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                slotProps={{ htmlInput: { 'aria-label': 'Transaction date' } }}
              />
            </Field>
            <Field label="Note">
              <AppTextField
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional"
                slotProps={{ htmlInput: { 'aria-label': 'Transaction note' } }}
              />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-(--text-primary)">
                Categories
              </p>
              <Button
                onClick={() =>
                  setTransactionSplits([
                    ...transactionSplits,
                    { categoryId: '', amount: '' },
                  ])
                }
                sx={{
                  color: 'var(--accent-green)',
                  fontSize: '0.75rem',
                  minWidth: 0,
                  p: 0,
                }}
              >
                + Split category
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {transactionSplits.map((split, index) => (
                <div key={index} className="flex gap-2">
                  <AppTextField
                    select
                    required
                    value={split.categoryId}
                    onChange={(event) =>
                      setTransactionSplits(
                        transactionSplits.map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, categoryId: event.target.value }
                            : current,
                        ),
                      )
                    }
                    slotProps={{
                      select: {
                        displayEmpty: true,
                        inputProps: {
                          'aria-label': `Split ${index + 1} category`,
                        },
                      },
                    }}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    <MenuItem value="" disabled>
                      Choose category
                    </MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {groupById.get(category.group_id)?.name} ·{' '}
                        {category.name}
                      </MenuItem>
                    ))}
                  </AppTextField>
                  <AppTextField
                    required
                    type="number"
                    value={split.amount}
                    onChange={(event) =>
                      setTransactionSplits(
                        transactionSplits.map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, amount: event.target.value }
                            : current,
                        ),
                      )
                    }
                    placeholder="0.00"
                    slotProps={{
                      htmlInput: {
                        'aria-label': `Split ${index + 1} amount`,
                        min: 0.01,
                        step: '0.01',
                      },
                    }}
                    sx={{ flexShrink: 0, width: 112 }}
                  />
                  {transactionSplits.length > 1 && (
                    <IconButton
                      size="small"
                      onClick={() =>
                        setTransactionSplits(
                          transactionSplits.filter(
                            (_, currentIndex) => currentIndex !== index,
                          ),
                        )
                      }
                    >
                      ×
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
          </div>

          {validationError && (
            <p className="text-sm text-(--accent-red)">{validationError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={close}>Cancel</SecondaryButton>
            <PrimaryButton
              type="submit"
              disabled={disabled || analyzingReceipt}
            >
              Save transaction
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptImageButton({
  label,
  capture = false,
  disabled,
  onSelect,
}: {
  label: string;
  capture?: boolean;
  disabled?: boolean;
  onSelect: (file: File) => void;
}) {
  return (
    <Button
      component="label"
      variant="outlined"
      color="inherit"
      disabled={disabled}
    >
      {label}
      <input
        aria-label={label}
        hidden
        type="file"
        accept={RECEIPT_IMAGE_TYPES.join(',')}
        capture={capture ? 'environment' : undefined}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) onSelect(file);
        }}
      />
    </Button>
  );
}

function ReceiptReviewNotice({ analysis }: { analysis: ReceiptAnalysis }) {
  const uncertainItems = analysis.items.filter(
    (item) => item.requiresReview || item.confidence < 0.7,
  );
  const extractedParts = [
    analysis.subtotal === null
      ? null
      : `Subtotal ${formatCurrency(analysis.subtotal)}`,
    analysis.tax === null ? null : `Tax ${formatCurrency(analysis.tax)}`,
    analysis.discounts
      ? `Discounts ${formatCurrency(analysis.discounts)}`
      : null,
    analysis.tip ? `Tip ${formatCurrency(analysis.tip)}` : null,
    analysis.fees ? `Fees ${formatCurrency(analysis.fees)}` : null,
  ].filter(Boolean);

  return (
    <Alert severity={analysis.requiresReview ? 'warning' : 'success'}>
      <p className="font-medium">
        {analysis.requiresReview
          ? 'The receipt needs your review before saving.'
          : 'Receipt details are ready to review.'}
      </p>
      {extractedParts.length > 0 && (
        <p className="mt-1 text-xs">{extractedParts.join(' · ')}</p>
      )}
      {analysis.reviewReasons.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {analysis.reviewReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {uncertainItems.length > 0 && (
        <p className="mt-2 text-xs">
          Uncertain items:{' '}
          {uncertainItems.map(({ description }) => description).join(', ')}
        </p>
      )}
      <p className="mt-2 text-xs">
        Nothing will be saved until you confirm below.
      </p>
    </Alert>
  );
}

function NewGroupDialog({
  open,
  disabled,
  onClose,
  onSave,
}: {
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>New budget group</DialogTitle>
      <DialogContent>
        <form
          className="mt-2 flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSave(name);
            setName('');
          }}
        >
          <Field label="Group name">
            <AppTextField
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Food"
              slotProps={{ htmlInput: { 'aria-label': 'Group name' } }}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" disabled={disabled || !name.trim()}>
              Add group
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-xs font-medium text-(--text-secondary)">
      <span>{label}</span>
      {children}
    </div>
  );
}

function BudgetLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2"
        style={{
          borderColor: 'var(--accent-green)',
          borderTopColor: 'transparent',
        }}
      />
    </div>
  );
}
