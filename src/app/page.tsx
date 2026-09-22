import { ModuleCard } from '@/components/portal/ModuleCard'
import { portalModules } from '@/lib/portal-modules'

export default function PortalHomePage() {
  return (
    <div className="flex flex-col gap-10 py-4">
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-green)]">
          One place for home life
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-tight text-[var(--text-primary)] sm:text-5xl">
          Welcome to your Family Portal.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
          Keep the practical parts of family life organized, visible, and easy to share.
          Choose a module to get started.
        </p>
      </section>

      <section className="grid gap-5 sm:grid-cols-2" aria-label="Family Portal modules">
        {portalModules.map((module) => (
          <ModuleCard key={module.href} module={module} />
        ))}
      </section>
    </div>
  )
}
