import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { BudgetNav } from './BudgetNav';

let mockPathname = '/budget';
let mockDesktop = true;
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: () => mockDesktop,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ onClick, ...props }: React.ComponentProps<'a'>) => (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  ),
}));

beforeEach(() => {
  mockDesktop = true;
  mockPathname = '/budget';
});
test.each([
  ['/budget', 'Monthly Plan'],
  ['/budget/debt-dashboard', 'Debt Dashboard'],
  ['/budget/debts', 'Manage Debts'],
  ['/budget/settings', 'Payoff Settings'],
  ['/budget/debts/some-debt', 'Manage Debts'],
])(
  'budget tabs identify the current %s page and keep all destinations',
  (path, label) => {
    mockPathname = path;
    render(<BudgetNav />);
    expect(
      screen.getByRole('tab', { name: label, hidden: true }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab', { hidden: true })).toHaveLength(4);
    expect(
      screen.queryByRole('button', { name: /Budget section/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Monthly Plan', hidden: true }),
    ).toHaveAttribute('href', '/budget');
  },
);

test('phone picker exposes every budget section and closes after choosing one', async () => {
  mockDesktop = false;
  mockPathname = '/budget/debts';
  render(<BudgetNav />);
  const trigger = screen.getByRole('button', {
    name: 'Budget section: Manage Debts',
  });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  const menu = within(screen.getByRole('menu'));
  expect(menu.getAllByRole('menuitem')).toHaveLength(4);
  expect(menu.getByRole('menuitem', { name: 'Manage Debts' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(
    menu.getByRole('menuitem', { name: 'Payoff Settings' }),
  ).toHaveAttribute('href', '/budget/settings');
  fireEvent.click(menu.getByRole('menuitem', { name: 'Payoff Settings' }));
  await waitFor(() =>
    expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('phone picker supports Escape and resets after navigation or desktop resize', async () => {
  mockDesktop = false;
  const { rerender } = render(<BudgetNav />);
  const trigger = screen.getByRole('button', {
    name: 'Budget section: Monthly Plan',
  });
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  mockPathname = '/budget/debt-dashboard';
  rerender(<BudgetNav />);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Budget section: Debt Dashboard' }),
  );
  mockDesktop = true;
  rerender(<BudgetNav />);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  mockDesktop = false;
  rerender(<BudgetNav />);
  expect(
    screen.getByRole('button', { name: 'Budget section: Debt Dashboard' }),
  ).toHaveAttribute('aria-expanded', 'false');
});
