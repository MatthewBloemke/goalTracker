import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import MonthlyBudgetPage from './page';
import {
  calculateMonthlyBudget,
  toBudgetMonth,
  shiftBudgetMonth,
} from './_lib/budget';
import type { useBudget } from './_hooks/useBudget';
import type {
  BudgetGroup,
  BudgetCategory,
  MonthlyBudget,
  MonthlyBudgetAllocation,
  BudgetTransaction,
  BudgetTransactionSplit,
} from '@/types';

let mockData: ReturnType<typeof useBudget>;
const mockAnalyze = jest.fn();
const mockReset = jest.fn();
jest.mock('./_hooks/useBudget', () => ({ useBudget: () => mockData }));
jest.mock('@/hooks/useFamily', () => ({
  useFamily: () => ({
    family: { id: 'family', name: 'Smiths' },
    loading: false,
  }),
}));
jest.mock('./_hooks/useReceiptScanner', () => ({
  useReceiptScanner: () => ({
    analysis: null,
    error: null,
    analyzing: false,
    analyze: mockAnalyze,
    reset: mockReset,
  }),
}));

function fixture(): ReturnType<typeof useBudget> {
  const group = (id: string, name: string, is_system = false): BudgetGroup => ({
    id,
    name,
    is_system,
    user_id: 'user',
    family_id: 'family',
    sort_order: 0,
    archived_at: null,
    created_at: '',
    updated_at: '',
  });
  const groups = [
    group('food', 'Food'),
    group('housing', 'Housing'),
    group('debt', 'Debt', true),
  ];
  const category = (
    id: string,
    name: string,
    group_id: string,
    loan_id: string | null = null,
  ): BudgetCategory => ({
    id,
    name,
    group_id,
    loan_id,
    is_system: !!loan_id,
    sort_order: 0,
    archived_at: null,
    created_at: '',
    updated_at: '',
  });
  const categories = [
    category('groceries', 'Groceries', 'food'),
    category('rent', 'Rent', 'housing'),
    category('loan', 'Car loan', 'debt', 'loan-id'),
  ];
  const budget: MonthlyBudget = {
    id: 'budget',
    user_id: 'user',
    family_id: 'family',
    month: toBudgetMonth(new Date()),
    income: 1000,
    created_by: 'user',
    created_at: '',
    updated_at: '',
  };
  const allocations: MonthlyBudgetAllocation[] = categories.map((c, i) => ({
    id: c.id,
    monthly_budget_id: budget.id,
    category_id: c.id,
    planned_amount: [200, 500, 200][i],
    rollover_amount: i === 0 ? 50 : 0,
    created_at: '',
    updated_at: '',
  }));
  const transactions: BudgetTransaction[] = [
    {
      id: 'payment',
      user_id: 'user',
      family_id: 'family',
      created_by: 'user',
      amount: 200,
      occurred_on: budget.month,
      merchant: 'Car payment',
      note: null,
      source: 'debt_payment',
      payment_id: 'payment-id',
      receipt_storage_path: null,
      created_at: '',
      updated_at: '',
    },
  ];
  const splits: BudgetTransactionSplit[] = [
    {
      id: 'split',
      transaction_id: 'payment',
      category_id: 'loan',
      amount: 200,
      created_at: '',
    },
  ];
  return {
    budget,
    previousBudget: {
      ...budget,
      id: 'previous',
      month: shiftBudgetMonth(budget.month, -1),
    },
    groups,
    categories,
    allocations,
    transactions,
    splits,
    summary: calculateMonthlyBudget(
      budget,
      groups,
      categories,
      allocations,
      transactions,
      splits,
    ),
    loading: false,
    mutating: false,
    error: null,
    realtimeConnected: true,
    refetch: jest.fn().mockResolvedValue(undefined),
    createBudget: jest.fn().mockResolvedValue(true),
    copyPreviousMonth: jest.fn().mockResolvedValue(true),
    updateIncome: jest.fn().mockResolvedValue(true),
    createGroup: jest.fn().mockResolvedValue(true),
    archiveGroup: jest.fn().mockResolvedValue(true),
    createCategory: jest.fn().mockResolvedValue(true),
    archiveCategory: jest.fn().mockResolvedValue(true),
    updateAllocation: jest.fn().mockResolvedValue(true),
    createTransaction: jest.fn().mockResolvedValue(true),
    deleteTransaction: jest.fn().mockResolvedValue(true),
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockData = fixture();
});

test('the balance is the focal point; surplus and paid debts remain visible without management controls', () => {
  render(<MonthlyBudgetPage />);
  expect(
    screen.getByRole('status', { name: 'Budget balance' }),
  ).toHaveTextContent('Left to assign$100.00');
  expect(
    screen.getByText('+$50.00 carried over from last month'),
  ).toBeVisible();
  expect(screen.getByText('+$50.00 from last month')).toBeVisible();
  expect(screen.getByText('Paid this month')).toBeVisible();
  expect(
    screen.getByRole('spinbutton', { name: 'Car loan planned amount' }),
  ).toHaveValue(200);
  expect(
    screen.queryByRole('button', { name: 'Add group' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Remove.*(?:category|group)/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Every dollar has a job')).not.toBeInTheDocument();
});

test.each([
  ['balanced', 0, 'Fully assigned'],
  ['over-planned', -75, 'Over-assigned'],
] as const)(
  'the %s state is explicit, not color-only',
  (status, unassigned, label) => {
    mockData.summary = { ...mockData.summary, status, unassigned, rollover: 0 };
    render(<MonthlyBudgetPage />);
    expect(screen.getByRole('status')).toHaveTextContent(label);
    expect(
      screen.queryByText(/carried over from last month/),
    ).not.toBeInTheDocument();
  },
);

test('collapse/expand preserves draft allocations and collapsed group totals', () => {
  render(<MonthlyBudgetPage />);
  const input = screen.getByRole('spinbutton', {
    name: 'Groceries planned amount',
  });
  fireEvent.change(input, { target: { value: '220' } });
  fireEvent.click(screen.getByRole('button', { name: 'Collapse Food group' }));
  expect(input).not.toBeVisible();
  expect(
    within(screen.getByRole('button', { name: 'Expand Food group' })).getByText(
      '$250.00',
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Expand Food group' }));
  expect(input).toHaveValue(220);
  fireEvent.blur(input);
  expect(mockData.updateAllocation).toHaveBeenCalledWith('groceries', 220);
  fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
  expect(screen.getAllByRole('spinbutton')).toHaveLength(3);
});

test('edit groups reveals category and group actions but protects synced debt categories', async () => {
  render(<MonthlyBudgetPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit groups' }));
  expect(
    screen.getByRole('button', { name: 'Remove Food group' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Remove Groceries category' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Remove Debt group' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Remove Car loan category' }),
  ).not.toBeInTheDocument();
  const food = within(screen.getByRole('article', { name: 'Food group' }));
  fireEvent.click(food.getByRole('button', { name: '+ Add category' }));
  fireEvent.change(food.getByLabelText('Category name'), {
    target: { value: 'Restaurants' },
  });
  fireEvent.click(food.getByRole('button', { name: 'Add' }));
  await waitFor(() =>
    expect(mockData.createCategory).toHaveBeenCalledWith('food', 'Restaurants'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
  fireEvent.change(screen.getByLabelText('Group name'), {
    target: { value: 'Fun' },
  });
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Add group',
    }),
  );
  await waitFor(() => expect(mockData.createGroup).toHaveBeenCalledWith('Fun'));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Done editing' }));
  expect(
    screen.queryByRole('button', { name: /Remove.*category/ }),
  ).not.toBeInTheDocument();
});

test('formatted income can be edited, cancelled, and retried after a failed save', async () => {
  render(<MonthlyBudgetPage />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Edit monthly income, $1,000.00' }),
  );
  const input = screen.getByRole('spinbutton', { name: 'Monthly income' });
  fireEvent.change(input, { target: { value: '1200' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(mockData.updateIncome).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Edit monthly income/ }));
  const reopened = screen.getByRole('spinbutton', { name: 'Monthly income' });
  fireEvent.change(reopened, { target: { value: '' } });
  fireEvent.blur(reopened);
  expect(screen.getByText('Enter zero or a positive income.')).toBeVisible();
  expect(mockData.updateIncome).not.toHaveBeenCalled();
  (mockData.updateIncome as jest.Mock).mockResolvedValueOnce(false);
  fireEvent.change(reopened, { target: { value: '1200' } });
  fireEvent.blur(reopened);
  await waitFor(() => expect(mockData.updateIncome).toHaveBeenCalledWith(1200));
  expect(reopened).toHaveValue(1200);
  fireEvent.blur(reopened);
  await waitFor(() =>
    expect(
      screen.queryByRole('spinbutton', { name: 'Monthly income' }),
    ).not.toBeInTheDocument(),
  );
});

test.each([
  ['Scan receipt', 'environment'],
  ['Upload receipt', null],
])('receipt menu preserves %s input and never autosaves', (label, capture) => {
  render(<MonthlyBudgetPage />);
  expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Receipt' }));
  const input = screen.getByLabelText(label);
  expect(input.getAttribute('capture')).toBe(capture);
  const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
  expect(mockAnalyze).toHaveBeenCalledWith(file);
  expect(
    screen.getByRole('heading', { name: 'Add transaction' }),
  ).toBeVisible();
  expect(mockData.createTransaction).not.toHaveBeenCalled();
});

test('manual transactions and activity remain accessible from the simplified page', async () => {
  render(<MonthlyBudgetPage />);
  expect(screen.getByText('Car payment')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Transactions 1' }));
  expect(screen.getByText('Car payment')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
  expect(mockReset).toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Place or merchant'), {
    target: { value: 'Market' },
  });
  fireEvent.change(screen.getByLabelText('Total amount'), {
    target: { value: '25' },
  });
  fireEvent.mouseDown(
    screen.getByRole('combobox', { name: 'Split 1 category' }),
  );
  fireEvent.click(
    await screen.findByRole('option', { name: 'Food · Groceries' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }));
  await waitFor(() =>
    expect(mockData.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant: 'Market',
        amount: 25,
        splits: [{ categoryId: 'groceries', amount: 25 }],
      }),
    ),
  );
});

test('new months retain explicit blank/copy actions and errors stay visible', () => {
  mockData.budget = null;
  mockData.error = 'Connection lost';
  render(<MonthlyBudgetPage />);
  expect(screen.getByText('Connection lost')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Copy .* plan/ }));
  expect(mockData.copyPreviousMonth).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Start blank month' }));
  expect(mockData.createBudget).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  expect(screen.getByRole('button', { name: 'This month' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'This month' }));
  expect(
    screen.queryByRole('button', { name: 'This month' }),
  ).not.toBeInTheDocument();
});
