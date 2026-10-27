import { render, screen } from '@testing-library/react';
import { BudgetNav } from './BudgetNav';

let mockPathname = '/budget';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
test.each([
  ['/budget', 'Monthly Plan'],
  ['/budget/debt-dashboard', 'Debt Dashboard'],
  ['/budget/debts', 'Manage Debts'],
  ['/budget/settings', 'Payoff Settings'],
])(
  'budget tabs identify the current %s page and keep all destinations',
  (path, label) => {
    mockPathname = path;
    render(<BudgetNav />);
    expect(screen.getByRole('tab', { name: label })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Monthly Plan' })).toHaveAttribute(
      'href',
      '/budget',
    );
  },
);
