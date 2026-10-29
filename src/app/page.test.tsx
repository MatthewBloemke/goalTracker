import { render, screen, within } from '@testing-library/react';
import PortalHomePage from './page';
import { portalModules } from '@/lib/portal-modules';
import { ModuleCard } from '@/components/portal/ModuleCard';

test('home is a compact two-column launcher with all four destinations', () => {
  render(<PortalHomePage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Home' }),
  ).toBeInTheDocument();
  const grid = screen.getByRole('region', { name: 'Family Portal modules' });
  expect(grid).toHaveClass('grid-cols-2', 'lg:grid-cols-4');
  expect(within(grid).getAllByRole('link')).toHaveLength(4);
  for (const portalModule of portalModules) {
    const link = within(grid).getByRole('link', { name: portalModule.name });
    expect(link).toHaveAttribute('href', portalModule.href);
    expect(
      within(link).getByRole('heading', { level: 2, name: portalModule.name }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(portalModule.description),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(portalModule.eyebrow)).not.toBeInTheDocument();
  }
  expect(
    screen.queryByText(/Welcome to your Family Portal/),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/One place for home life/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Open module/)).not.toBeInTheDocument();
});

test('all four launched modules are available', () => {
  render(<PortalHomePage />);
  expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  for (const portalModule of portalModules) {
    expect(screen.getByRole('link', { name: portalModule.name })).not.toHaveAttribute(
      'aria-describedby',
    );
  }
  expect(screen.queryByText('Foundation ready')).not.toBeInTheDocument();
});

test('future modules retain a functional tile without a custom icon', () => {
  render(
    <ModuleCard
      module={{
        ...portalModules[0],
        href: '/new-section',
        name: 'New section',
      }}
    />,
  );
  expect(screen.getByRole('link', { name: 'New section' })).toHaveAttribute(
    'href',
    '/new-section',
  );
});
