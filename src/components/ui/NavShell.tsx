'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Button from '@mui/material/Button';
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/MenuRounded';
import CloseIcon from '@mui/icons-material/CloseRounded';
import LogoutIcon from '@mui/icons-material/LogoutRounded';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { portalModules } from '@/lib/portal-modules';

const hideNavOn = ['/login'];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { supabase, user } = useSupabase();
  const router = useRouter();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const showNav = user && !hideNavOn.includes(pathname);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <header className="glass sticky top-0 z-50 border-b border-[var(--border)]">
        <Box
          sx={{ minHeight: { xs: 56, md: 64 } }}
          className="mx-auto flex max-w-6xl items-center gap-4 px-4"
        >
          <Link
            href="/"
            className="mr-auto flex min-h-11 items-center gap-2.5"
            aria-label="Family Portal home"
          >
            <PortalMark />
            <span className="font-serif text-lg text-[var(--text-primary)]">
              Family Portal
            </span>
          </Link>

          <Box
            component="nav"
            sx={{ display: { xs: 'none', md: 'flex' } }}
            className="items-center gap-1"
            aria-label="Portal modules"
          >
            {portalModules.map((module) => {
              const active =
                pathname === module.href ||
                pathname.startsWith(`${module.href}/`);
              return (
                <Link
                  key={module.href}
                  href={module.href}
                  aria-current={active ? 'page' : undefined}
                  className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    color: active ? module.accent : 'var(--text-secondary)',
                    background: active ? `${module.accent}16` : 'transparent',
                  }}
                >
                  <span className="sm:hidden lg:inline">{module.name}</span>
                  <span className="hidden sm:inline lg:hidden">
                    {module.shortName}
                  </span>
                </Link>
              );
            })}
          </Box>

          <Box
            sx={{ display: { xs: 'none', md: 'flex' } }}
            className="items-center gap-1"
          >
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
          </Box>
          {!isDesktop && (
            <MobilePortalNav
              key={pathname}
              pathname={pathname}
              onSignOut={handleSignOut}
            />
          )}
        </Box>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-8">
        {children}
      </main>
    </div>
  );
}

function MobilePortalNav({
  pathname,
  onSignOut,
}: {
  pathname: string;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const destinations = [{ href: '/', name: 'Home' }, ...portalModules];
  const accountLinks = [
    { href: '/family', name: 'Family members' },
    { href: '/settings', name: 'Portal settings' },
  ];
  const renderLink = ({ href, name }: { href: string; name: string }) => {
    const active =
      pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
    return (
      <ListItemButton
        key={href}
        component={Link}
        href={href}
        selected={active}
        aria-current={active ? 'page' : undefined}
        onClick={close}
        sx={{
          minHeight: 48,
          borderRadius: 2,
          mb: 0.5,
          '&.Mui-selected': {
            boxShadow: 'inset 3px 0 0',
            color: 'primary.main',
          },
        }}
      >
        <ListItemText
          primary={name}
          slotProps={{ primary: { sx: { fontWeight: active ? 600 : 400 } } }}
        />
      </ListItemButton>
    );
  };
  return (
    <>
      <IconButton
        aria-label="Open navigation"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? 'portal-mobile-navigation' : undefined}
        onClick={() => setOpen(true)}
        sx={{
          display: { xs: 'inline-flex', md: 'none' },
          width: 44,
          height: 44,
          color: 'text.primary',
        }}
      >
        <MenuIcon />
      </IconButton>
      <Drawer
        anchor="right"
        open={open}
        onClose={close}
        slotProps={{
          paper: {
            id: 'portal-mobile-navigation',
            role: 'dialog',
            'aria-modal': true,
            'aria-label': 'Navigation',
            sx: {
              width: 320,
              maxWidth: 'calc(100vw - 32px)',
              p: 2,
              pb: 'max(16px, env(safe-area-inset-bottom))',
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h6">Family Portal</Typography>
          <IconButton
            aria-label="Close navigation"
            onClick={close}
            sx={{ width: 44, height: 44 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <nav aria-label="Mobile portal navigation">
          <List disablePadding>{destinations.map(renderLink)}</List>
          <Divider sx={{ my: 2 }} />
          <List disablePadding>{accountLinks.map(renderLink)}</List>
        </nav>
        <Box sx={{ mt: 'auto', pt: 3 }}>
          <Button
            fullWidth
            color="inherit"
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={() => {
              close();
              void onSignOut();
            }}
            sx={{ minHeight: 44 }}
          >
            Sign out
          </Button>
        </Box>
      </Drawer>
    </>
  );
}

function PortalMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-green-glow)] text-[var(--accent-green)]">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </svg>
    </span>
  );
}

function FamilyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
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
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.04 14H3v-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3.04V3h4v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 20.96 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}
