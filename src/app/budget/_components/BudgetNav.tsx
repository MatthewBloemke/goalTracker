'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tab, Tabs } from '@mui/material';

const links = [
  { href: '/budget', label: 'Monthly Plan' },
  { href: '/budget/debt-dashboard', label: 'Debt Dashboard' },
  { href: '/budget/debts', label: 'Manage Debts' },
  { href: '/budget/settings', label: 'Payoff Settings' },
];

export function BudgetNav() {
  const pathname = usePathname();
  const active =
    links.find(({ href }) => href !== '/budget' && pathname.startsWith(href))
      ?.href ?? '/budget';
  return (
    <Tabs
      value={active}
      variant="scrollable"
      scrollButtons="auto"
      aria-label="Budget navigation"
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      {links.map(({ href, label }) => (
        <Tab
          key={href}
          component={Link}
          href={href}
          value={href}
          label={label}
        />
      ))}
    </Tabs>
  );
}
