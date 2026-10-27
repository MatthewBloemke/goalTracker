import { MealPlanningNav } from './_components/MealPlanningNav';

export default function MealPlanningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MealPlanningNav />
      {children}
    </>
  );
}
