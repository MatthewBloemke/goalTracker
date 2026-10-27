import { ModuleCard } from '@/components/portal/ModuleCard';
import { portalModules } from '@/lib/portal-modules';

export default function PortalHomePage() {
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <h1 className="font-serif text-3xl text-[var(--text-primary)]">Home</h1>

      <section
        className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        aria-label="Family Portal modules"
      >
        {portalModules.map((module) => (
          <ModuleCard key={module.href} module={module} />
        ))}
      </section>
    </div>
  );
}
