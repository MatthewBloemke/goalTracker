import { BudgetNav } from './_components/BudgetNav';

export default function BudgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <BudgetNav />
      {children}
    </div>
  );
}
