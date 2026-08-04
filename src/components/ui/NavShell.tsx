'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Button from '@mui/material/Button';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { useRouter } from 'next/navigation';
import Logo from '../../../public/debtTracker.png';

const navItems = [
  { href: '/', label: 'Dashboard', icon: DashIcon },
  { href: '/loans', label: 'Loans', icon: LoansIcon },
  { href: '/family', label: 'Family', icon: FamilyIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

const hideNavOn = ['/login'];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { supabase, user } = useSupabase();
  const router = useRouter();

  const showNav = user && !hideNavOn.includes(pathname);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background)' }}
    >
      <header
        className="sticky top-0 z-50 glass border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src={Logo}
              alt="Debt Tracker"
              width={48}
              height={48}
              style={{ borderRadius: '26px' }}
            />
            <span
              className="font-serif text-lg"
              style={{ color: 'var(--text-primary)' }}
            >
              Debt Snowball
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: active
                      ? 'var(--accent-green)'
                      : 'var(--text-secondary)',
                    background: active ? 'rgba(16,212,126,0.1)' : 'transparent',
                  }}
                >
                  <Icon />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
            <Button
              onClick={handleSignOut}
              variant="outlined"
              color="inherit"
              size="small"
              sx={{
                ml: 1,
                px: 1.5,
                py: 0.75,
                minWidth: 0,
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              Sign out
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function DashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
function LoansIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function FamilyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
