export type PortalModuleStatus = 'available' | 'coming-soon'

export interface PortalModule {
  href: string
  name: string
  shortName: string
  description: string
  eyebrow: string
  accent: string
  icon: string
  status: PortalModuleStatus
}

export const portalModules: PortalModule[] = [
  {
    href: '/budget',
    name: 'Budget',
    shortName: 'Budget',
    description: 'Plan family finances, track debt, and celebrate every payoff milestone.',
    eyebrow: 'Finances',
    accent: '#0fd67c',
    icon: '$',
    status: 'available',
  },
  {
    href: '/meal-planning',
    name: 'Meal Planning',
    shortName: 'Meals',
    description: 'Coordinate meals, recipes, grocery needs, and the week ahead.',
    eyebrow: 'Kitchen',
    accent: '#f5a623',
    icon: 'M',
    status: 'coming-soon',
  },
  {
    href: '/family-library',
    name: 'Family Library',
    shortName: 'Library',
    description: 'See which movies the family already owns and arrange to borrow them.',
    eyebrow: 'Shared collection',
    accent: '#5b5ff5',
    icon: 'F',
    status: 'coming-soon',
  },
  {
    href: '/task-planner',
    name: 'Task Planner',
    shortName: 'Tasks',
    description: 'Organize larger household projects into flexible, prioritized task lists.',
    eyebrow: 'Household',
    accent: '#38bdf8',
    icon: 'T',
    status: 'available',
  },
]
