'use client';

import { SectionNav } from '@/components/ui/SectionNav';

const links = [
  { href: '/budget', label: 'Monthly Plan' },
  { href: '/budget/debt-dashboard', label: 'Debt Dashboard' },
  { href: '/budget/debts', label: 'Manage Debts' },
  { href: '/budget/settings', label: 'Payoff Settings' },
];

export function BudgetNav() {
  return (
    <SectionNav label="Budget" ariaLabel="Budget navigation" links={links} />
  );
}
