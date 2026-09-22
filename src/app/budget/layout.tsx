import Link from 'next/link'

const budgetLinks = [
  { href: '/budget', label: 'Monthly Plan' },
  { href: '/budget/debt-dashboard', label: 'Debt Dashboard' },
  { href: '/budget/debts', label: 'Manage Debts' },
  { href: '/budget/settings', label: 'Payoff Settings' },
]

export default function BudgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-green)]">Budget</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Debt payoff and family finances</p>
        </div>
        <nav className="flex max-w-full gap-1 overflow-x-auto" aria-label="Budget navigation">
          {budgetLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  )
}
