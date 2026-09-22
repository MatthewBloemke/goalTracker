import { ModuleLanding } from '@/components/portal/ModuleLanding'
import { portalModules } from '@/lib/portal-modules'

const familyLibraryModule = portalModules.find(({ href }) => href === '/family-library')!

export default function FamilyLibraryPage() {
  return <ModuleLanding module={familyLibraryModule} capabilities={[
    'Manually catalog owned movies',
    'Search by title, genre, and owner',
    'Track who has borrowed an item',
    'Build a family watchlist',
  ]} />
}
