'use client';

import { useId } from 'react';
import Link from 'next/link';
import { Box, ButtonBase, Typography } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import RestaurantIcon from '@mui/icons-material/RestaurantMenuRounded';
import MovieIcon from '@mui/icons-material/LocalMoviesOutlined';
import ChecklistIcon from '@mui/icons-material/ChecklistRounded';
import WidgetsIcon from '@mui/icons-material/WidgetsOutlined';
import type { PortalModule } from '@/lib/portal-modules';

const moduleIcons: Record<string, typeof WidgetsIcon> = {
  '/budget': AccountBalanceWalletIcon,
  '/meal-planning': RestaurantIcon,
  '/family-library': MovieIcon,
  '/task-planner': ChecklistIcon,
};

export function ModuleCard({ module }: { module: PortalModule }) {
  const id = useId();
  const Icon = moduleIcons[module.href] ?? WidgetsIcon;
  const comingSoon = module.status === 'coming-soon';
  return (
    <ButtonBase
      component={Link}
      href={module.href}
      aria-labelledby={`${id}-title`}
      aria-describedby={comingSoon ? `${id}-status` : undefined}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        width: '100%',
        minWidth: 0,
        minHeight: { xs: 144, sm: 176 },
        height: '100%',
        p: { xs: 2, sm: 3 },
        gap: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        textAlign: 'left',
        color: 'text.primary',
        background: `linear-gradient(145deg, ${module.accent}12, var(--surface) 70%)`,
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': {
          borderColor: module.accent,
          boxShadow: `0 2px 12px ${module.accent}14`,
        },
        '&.Mui-focusVisible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 3,
        },
      }}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 2,
          background: `${module.accent}20`,
        }}
      >
        <Icon sx={{ fontSize: 24 }} />
      </Box>
      <Box>
        <Typography
          component="h2"
          id={`${id}-title`}
          sx={{
            fontSize: { xs: '1rem', sm: '1.125rem' },
            fontWeight: 600,
            lineHeight: 1.35,
            overflowWrap: 'anywhere',
          }}
        >
          {module.name}
        </Typography>
        {comingSoon && (
          <Typography
            component="span"
            id={`${id}-status`}
            sx={{
              display: 'block',
              mt: 0.5,
              fontSize: '0.75rem',
              color: 'text.secondary',
            }}
          >
            Coming soon
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}
