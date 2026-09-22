'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Button from '@mui/material/Button'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import { portalModules } from '@/lib/portal-modules'

const hideNavOn = ['/login']

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { supabase, user } = useSupabase()
  const router = useRouter()

  const showNav = user && !hideNavOn.includes(pathname)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!showNav) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <header className="glass sticky top-0 z-50 border-b border-[var(--border)]">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <Link href="/" className="mr-auto flex items-center gap-2.5" aria-label="Family Portal home">
            <PortalMark />
            <span className="font-serif text-lg text-[var(--text-primary)]">Family Portal</span>
          </Link>

          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-2 sm:w-auto" aria-label="Portal modules">
            {portalModules.map((module) => {
              const active = pathname === module.href || pathname.startsWith(`${module.href}/`)
              return (
                <Link
                  key={module.href}
                  href={module.href}
                  className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    color: active ? module.accent : 'var(--text-secondary)',
                    background: active ? `${module.accent}16` : 'transparent',
                  }}
                >
                  <span className="sm:hidden lg:inline">{module.name}</span>
                  <span className="hidden sm:inline lg:hidden">{module.shortName}</span>
                </Link>
              )
            })}
          </nav>

          <div className="order-2 flex items-center gap-1 sm:order-3">
            <Link
              href="/family"
              className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
              aria-label="Family members"
              title="Family members"
            >
              <FamilyIcon />
            </Link>
            <Link
              href="/settings"
              className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
              aria-label="Portal settings"
              title="Settings"
            >
              <SettingsIcon />
            </Link>
            <Button
              onClick={handleSignOut}
              variant="outlined"
              color="inherit"
              size="small"
              sx={{ minWidth: 0, px: 1.5, py: 0.75, fontSize: '0.75rem' }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  )
}

function PortalMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-green-glow)] text-[var(--accent-green)]">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </svg>
    </span>
  )
}

function FamilyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.04 14H3v-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3.04V3h4v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 20.96 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}
