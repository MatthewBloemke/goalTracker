import Link from 'next/link'
import type { PortalModule } from '@/lib/portal-modules'

export function ModuleCard({ module }: { module: PortalModule }) {
  return (
    <Link
      href={module.href}
      className="group relative min-h-64 overflow-hidden rounded-3xl border p-6 transition-all duration-200 hover:-translate-y-1"
      style={{
        background: `linear-gradient(145deg, ${module.accent}16, var(--surface) 48%)`,
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: module.accent }}
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold"
            style={{ background: `${module.accent}20`, color: module.accent }}
          >
            {module.icon}
          </span>
          {module.status === 'coming-soon' && (
            <span
              className="rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider"
              style={{ borderColor: `${module.accent}55`, color: module.accent }}
            >
              Foundation ready
            </span>
          )}
        </div>
        <div className="mt-auto pt-10">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: module.accent }}
          >
            {module.eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[var(--text-primary)]">
            {module.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {module.description}
          </p>
          <span
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium transition-transform group-hover:translate-x-1"
            style={{ color: module.accent }}
          >
            Open module <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
