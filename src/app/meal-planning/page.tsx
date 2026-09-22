import { ModuleLanding } from '@/components/portal/ModuleLanding'
import { portalModules } from '@/lib/portal-modules'

const mealPlanningModule = portalModules.find(({ href }) => href === '/meal-planning')!

export default function MealPlanningPage() {
  return <ModuleLanding module={mealPlanningModule} capabilities={[
    'Weekly meal calendar',
    'Shared recipe collection',
    'Grocery list generation',
    'Family preferences and favorites',
  ]} />
}
