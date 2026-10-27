'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckIcon from '@mui/icons-material/CheckRounded';

interface SectionLink {
  href: string;
  label: string;
}

interface SectionNavProps {
  label: string;
  ariaLabel: string;
  links: readonly SectionLink[];
}

/** Full tabs on wider screens; a compact, fully labeled picker on phones. */
export function SectionNav({ label, ariaLabel, links }: SectionNavProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('sm'));
  const active =
    [...links]
      .reverse()
      .find(
        ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
      ) ?? links[0];
  if (!active) return null;

  return (
    <>
      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <Tabs
          value={active.href}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={ariaLabel}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {links.map(({ href, label: linkLabel }) => (
            <Tab
              key={href}
              component={Link}
              href={href}
              value={href}
              label={linkLabel}
              aria-current={href === active.href ? 'page' : undefined}
            />
          ))}
        </Tabs>
      </Box>
      {!isDesktop && (
        <MobileSectionNav
          key={pathname}
          label={label}
          ariaLabel={ariaLabel}
          links={links}
          active={active}
        />
      )}
    </>
  );
}

function MobileSectionNav({
  label,
  ariaLabel,
  links,
  active,
}: SectionNavProps & { active: SectionLink }) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  return (
    <Box
      component="nav"
      aria-label={`${ariaLabel} mobile`}
      sx={{
        display: { xs: 'flex', sm: 'none' },
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        borderBottom: 1,
        borderColor: 'divider',
        pb: 1,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Button
        id={`${id}-button`}
        color="inherit"
        endIcon={<ExpandMoreIcon />}
        aria-label={`${label} section: ${active.label}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? `${id}-menu` : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ minHeight: 44, px: 1.5, py: 0.75, minWidth: 0, fontWeight: 600 }}
      >
        {active.label}
      </Button>
      <Menu
        id={`${id}-menu`}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          list: { 'aria-labelledby': `${id}-button` },
          paper: { sx: { minWidth: 240, maxWidth: 'calc(100vw - 32px)' } },
        }}
      >
        {links.map(({ href, label: linkLabel }) => (
          <MenuItem
            key={href}
            component={Link}
            href={href}
            selected={href === active.href}
            aria-current={href === active.href ? 'page' : undefined}
            onClick={close}
            sx={{ minHeight: 48, gap: 2, justifyContent: 'space-between' }}
          >
            {linkLabel}
            {href === active.href && <CheckIcon fontSize="small" />}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
