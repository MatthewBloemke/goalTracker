'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
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

export default function MonthlyBudgetPage() {
  const { family, loading: familyLoading } = useFamily();
  const [month, setMonth] = useState(() => toBudgetMonth(new Date()));
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl text-(--text-primary)">
              Monthly Plan
            </h1>
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
              {realtimeConnected ? 'Live' : 'Connecting'}
            </span>
          </div>
          <p className="mt-1 text-sm text-(--text-secondary)">
            {family ? `${family.name}'s shared budget` : 'Your personal budget'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton onClick={() => setShowGroupForm(true)}>
            Add group
          </SecondaryButton>
          <ReceiptImageButton
            label="Scan receipt"
            capture
            disabled={categories.length === 0 || receiptScanner.analyzing}
            onSelect={(file) => {
              setShowTransactionForm(true);
              void receiptScanner.analyze(file);
            }}
          />
          <ReceiptImageButton
            label="Upload receipt"
            disabled={categories.length === 0 || receiptScanner.analyzing}
            onSelect={(file) => {
              setShowTransactionForm(true);
              void receiptScanner.analyze(file);
            }}
          />
          <PrimaryButton
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
          <BudgetStatus
            unassigned={summary.unassigned}
            status={summary.status}
          />
          <section className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-secondary)">
                  Every dollar has a job
                </p>
                <h2 className="mt-1 font-serif text-2xl text-(--text-primary)">
                  Category plan
                </h2>
              </div>
              <span className="text-sm text-(--text-secondary)">
                {groups.length} group{groups.length === 1 ? '' : 's'}
              </span>
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
              summary.groups.map((groupSnapshot) => (
                <BudgetGroupCard
                  key={groupSnapshot.group.id}
                  snapshot={groupSnapshot}
                  disabled={mutating}
                  onAllocationChange={budgetData.updateAllocation}
                  onAddCategory={budgetData.createCategory}
                  onDeleteCategory={budgetData.archiveCategory}
                  onDeleteGroup={budgetData.archiveGroup}
                />
              ))
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
    <div className="glass flex items-center justify-between rounded-2xl px-3 py-2">
      <IconButton
        aria-label="Previous month"
        onClick={() => onChange(shiftBudgetMonth(month, -1))}
        color="inherit"
      >
        ←
      </IconButton>
      <div className="text-center">
        <p className="numeric-value text-xl font-medium text-(--text-primary)">
          {dayjs(month).format('MMMM YYYY')}
        </p>
        {month !== toBudgetMonth(new Date()) && (
          <Button
            size="small"
            onClick={() => onChange(toBudgetMonth(new Date()))}
            sx={{
              color: 'var(--accent-green)',
              fontSize: '0.75rem',
              minWidth: 0,
              p: 0,
            }}
          >
            Return to this month
          </Button>
        )}
      </div>
      <IconButton
        aria-label="Next month"
        onClick={() => onChange(shiftBudgetMonth(month, 1))}
        color="inherit"
      >
        →
      </IconButton>
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
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="Monthly income">
        <IncomeEditor
          key={income}
          income={income}
          disabled={disabled}
          onSave={onIncomeSave}
        />
      </SummaryCard>
      <SummaryCard
        label="Assigned this month"
        value={formatCurrency(summary.assigned)}
      />
      <SummaryCard
        label="Prior-month surplus"
        value={formatCurrency(summary.rollover)}
        accent={summary.rollover > 0}
      />
      <SummaryCard label="Spent so far" value={formatCurrency(summary.spent)} />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  children,
}: {
  label: string;
  value?: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wider text-(--text-secondary)">
        {label}
      </p>
      {children ?? (
        <p
          className="numeric-value mt-2 text-2xl font-medium"
          style={{
            color: accent ? 'var(--accent-green)' : 'var(--text-primary)',
          }}
        >
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

  return (
    <div className="mt-2">
      <AppTextField
        variant="standard"
        type="number"
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          const next = Number(value);
          if (Number.isFinite(next) && next >= 0 && next !== income)
            void onSave(next);
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
            fontSize: '1.5rem',
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
          title: 'Every dollar is planned',
          detail: 'Your income and category assignments are balanced.',
          color: 'var(--accent-green)',
        }
      : status === 'under-planned'
        ? {
            title: `${formatCurrency(unassigned)} still needs a job`,
            detail:
              'Assign the remaining income to categories to finish this plan.',
            color: 'var(--accent-amber)',
          }
        : {
            title: `${formatCurrency(Math.abs(unassigned))} over income`,
            detail: 'Reduce category assignments until the plan reaches zero.',
            color: 'var(--accent-red)',
          };

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border bg-(--surface) p-4"
      style={{ borderColor: content.color }}
    >
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: content.color }}
      />
      <div>
        <p className="font-medium" style={{ color: content.color }}>
          {content.title}
        </p>
        <p className="mt-0.5 text-sm text-(--text-secondary)">
          {content.detail}
        </p>
      </div>
    </div>
  );
}

function BudgetGroupCard({
  snapshot,
  disabled,
  onAllocationChange,
  onAddCategory,
  onDeleteCategory,
  onDeleteGroup,
}: {
  snapshot: ReturnType<
    typeof import('@/app/budget/_lib/budget').calculateMonthlyBudget
  >['groups'][number];
  disabled: boolean;
  onAllocationChange: (categoryId: string, amount: number) => Promise<boolean>;
  onAddCategory: (groupId: string, name: string) => Promise<boolean>;
  onDeleteCategory: (categoryId: string) => Promise<boolean>;
  onDeleteGroup: (groupId: string) => Promise<boolean>;
}) {
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingGroup, setEditingGroup] = useState(false);
  const { group } = snapshot;

  return (
    <article className="glass overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between gap-4 border-b border-(--border) px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-(--text-primary)">{group.name}</h3>
            {group.is_system && (
              <span className="rounded-full bg-(--accent-green-glow) px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-(--accent-green)">
                Synced
              </span>
            )}
          </div>
          <p className="numeric-value mt-0.5 text-xs text-(--text-secondary)">
            {formatCurrency(snapshot.spent)} spent of{' '}
            {formatCurrency(snapshot.available)} available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="numeric-value text-lg font-medium"
            style={{
              color:
                snapshot.remaining < 0
                  ? 'var(--accent-red)'
                  : 'var(--text-primary)',
            }}
          >
            {formatCurrency(snapshot.remaining)}
          </span>
          {!group.is_system && (
            <Button
              size="small"
              color="inherit"
              aria-pressed={editingGroup}
              aria-label={
                editingGroup
                  ? `Finish editing ${group.name} group`
                  : `Edit ${group.name} group`
              }
              onClick={() => {
                setEditingGroup((current) => !current);
                setAddingCategory(false);
              }}
              sx={{ color: 'var(--text-secondary)', minWidth: 0, px: 1 }}
            >
              {editingGroup ? 'Done' : 'Edit'}
            </Button>
          )}
        </div>
      </header>

      <div className="hidden grid-cols-[minmax(0,1fr)_130px_110px_150px] gap-3 border-b border-(--border) px-4 py-2 text-[0.65rem] uppercase tracking-wider text-(--text-secondary) sm:grid">
        <span>Category</span>
        <span>Plan</span>
        <span>Spent</span>
        <span>Remaining</span>
      </div>
      <div className="divide-y divide-(--border)">
        {snapshot.categories.map((categorySnapshot) => (
          <CategoryRow
            key={`${categorySnapshot.category.id}:${categorySnapshot.planned}`}
            snapshot={categorySnapshot}
            disabled={disabled}
            editing={editingGroup}
            onAllocationChange={onAllocationChange}
            onDelete={onDeleteCategory}
          />
        ))}
      </div>

      <footer className="border-t border-(--border) px-4 py-3">
        {addingCategory ? (
          <form
            className="flex gap-2"
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
          !group.is_system && (
            <div className="flex items-center justify-between gap-3">
              <Button
                onClick={() => setAddingCategory(true)}
                sx={{ color: 'var(--accent-green)', minWidth: 0, p: 0 }}
              >
                + Add category
              </Button>
              {editingGroup && (
                <Button
                  color="error"
                  size="small"
                  aria-label={`Remove ${group.name} group`}
                  onClick={() => void onDeleteGroup(group.id)}
                  sx={{ minWidth: 0, px: 1 }}
                >
                  Remove group
                </Button>
              )}
            </div>
          )
        )}
      </footer>
    </article>
  );
}

function CategoryRow({
  snapshot,
  disabled,
  editing,
  onAllocationChange,
  onDelete,
}: {
  snapshot: ReturnType<
    typeof import('@/app/budget/_lib/budget').calculateMonthlyBudget
  >['groups'][number]['categories'][number];
  disabled: boolean;
  editing: boolean;
  onAllocationChange: (categoryId: string, amount: number) => Promise<boolean>;
  onDelete: (categoryId: string) => Promise<boolean>;
}) {
  const [planned, setPlanned] = useState(String(snapshot.planned));
  const percent =
    snapshot.available > 0
      ? Math.min(100, (snapshot.spent / snapshot.available) * 100)
      : 0;

  return (
    <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_130px_110px_150px] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-(--text-primary)">
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
            +{formatCurrency(snapshot.rollover)} surplus from last month
          </p>
        )}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-(--surface-2)">
          <div
            className="h-full rounded-full"
            style={{
              width: `${percent}%`,
              background:
                snapshot.remaining < 0
                  ? 'var(--accent-red)'
                  : 'var(--accent-green)',
            }}
          />
        </div>
      </div>
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
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          },
        }}
        sx={{
          '& .MuiInputBase-input': { fontSize: '0.875rem', textAlign: 'right' },
        }}
      />
      <div className="flex justify-between text-sm sm:block">
        <span className="text-(--text-secondary) sm:hidden">Spent</span>
        <span className="numeric-value text-(--text-primary)">
          {formatCurrency(snapshot.spent)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-(--text-secondary) sm:hidden">Remaining</span>
        <span
          className="numeric-value"
          style={{
            color:
              snapshot.remaining < 0
                ? 'var(--accent-red)'
                : 'var(--text-primary)',
          }}
        >
          {formatCurrency(snapshot.remaining)}
        </span>
        {editing && !snapshot.category.is_system && (
          <Button
            color="error"
            size="small"
            aria-label={`Remove ${snapshot.category.name} category`}
            onClick={() => void onDelete(snapshot.category.id)}
            sx={{ fontSize: '0.75rem', minWidth: 0, px: 1 }}
          >
            Remove
          </Button>
        )}
      </div>
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
    <section className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-secondary)">
          Activity
        </p>
        <h2 className="mt-1 font-serif text-2xl text-(--text-primary)">
          Transactions
        </h2>
      </div>
      <div className="glass overflow-hidden rounded-2xl">
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
