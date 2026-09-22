import Link from 'next/link'
import type { PortalModule } from '@/lib/portal-modules'

export function ModuleLanding({
  module,
  capabilities,
}: {
  module: PortalModule
  capabilities: string[]
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-4">
      <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        ← Family Portal
      </Link>
      <section
        className="relative overflow-hidden rounded-3xl border p-8 sm:p-12"
        style={{
          background: `linear-gradient(145deg, ${module.accent}18, var(--surface) 58%)`,
          borderColor: 'var(--border)',
        }}
      >
        <div
          className="absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: module.accent }}
        />
        <div className="relative max-w-2xl">
          <span
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-semibold"
            style={{ background: `${module.accent}20`, color: module.accent }}
          >
            {module.icon}
          </span>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: module.accent }}>
            {module.eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl text-[var(--text-primary)] sm:text-5xl">
            {module.name}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
            {module.description}
          </p>
        </div>
      </section>
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Module roadmap
            </p>
            <h2 className="mt-2 font-serif text-2xl text-[var(--text-primary)]">Designed to include</h2>
          </div>
          <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
            Coming next
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {capabilities.map((capability) => (
            <div key={capability} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <span className="h-2 w-2 rounded-full" style={{ background: module.accent }} />
              <span className="text-sm text-[var(--text-primary)]">{capability}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
