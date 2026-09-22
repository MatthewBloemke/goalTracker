import { ModuleLanding } from '@/components/portal/ModuleLanding'
import { portalModules } from '@/lib/portal-modules'

const taskPlannerModule = portalModules.find(({ href }) => href === '/task-planner')!

export default function TaskPlannerPage() {
  return <ModuleLanding module={taskPlannerModule} capabilities={[
    'Project scope and checklist',
    'Target dates and assignments',
    'Estimated and actual costs',
    'Notes, supplies, and progress',
  ]} />
}
