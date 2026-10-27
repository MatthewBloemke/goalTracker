import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { NavShell } from './NavShell';
import { portalModules } from '@/lib/portal-modules';

let mockPathname = '/budget';
let mockDesktop = false;
let mockUser: { id: string } | null = { id: 'user' };
const mockPush = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue({ error: null });
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: () => mockDesktop,
}));
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({
    user: mockUser,
    supabase: { auth: { signOut: mockSignOut } },
  }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ onClick, ...props }: React.ComponentProps<'a'>) => (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  ),
}));

beforeEach(() => {
  mockPathname = '/budget';
  mockDesktop = false;
  mockUser = { id: 'user' };
});

const shell = (
  <NavShell>
    <h1>Page content</h1>
  </NavShell>
);

test('mobile menu includes all modules and account links with the active section marked', () => {
  mockPathname = '/budget/debts/loan';
  render(shell);
  const trigger = screen.getByRole('button', { name: 'Open navigation' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  const menu = within(screen.getByRole('dialog', { name: 'Navigation' }));
  for (const portalModule of portalModules) {
    expect(menu.getByRole('link', { name: portalModule.name })).toHaveAttribute(
      'href',
      portalModule.href,
    );
  }
  expect(menu.getByRole('link', { name: 'Budget' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(menu.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
    'aria-current',
  );
  expect(menu.getByRole('link', { name: 'Family members' })).toHaveAttribute(
    'href',
    '/family',
  );
  expect(menu.getByRole('link', { name: 'Portal settings' })).toHaveAttribute(
    'href',
    '/settings',
  );
  expect(menu.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
});

test.each(['Close navigation', 'Escape', 'Meal Planning'])(
  'mobile navigation dismisses via %s and returns focus',
  async (action) => {
    render(shell);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    if (action === 'Escape') fireEvent.keyDown(dialog, { key: 'Escape' });
    else if (action === 'Meal Planning')
      fireEvent.click(within(dialog).getByRole('link', { name: action }));
    else fireEvent.click(within(dialog).getByRole('button', { name: action }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  },
);

test('mobile sign out uses the existing authentication flow', async () => {
  render(shell);
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Sign out',
    }),
  );
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

test('external route changes and desktop resize dismiss the mobile drawer', () => {
  const { rerender } = render(shell);
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  mockPathname = '/settings';
  rerender(
    <NavShell>
      <h1>Settings</h1>
    </NavShell>,
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  expect(
    within(screen.getByRole('dialog')).getByRole('link', {
      name: 'Portal settings',
    }),
  ).toHaveAttribute('aria-current', 'page');
  mockDesktop = true;
  rerender(shell);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Open navigation' }),
  ).not.toBeInTheDocument();
  mockDesktop = false;
  rerender(
    <NavShell>
      <h1>Mobile again</h1>
    </NavShell>,
  );
  expect(
    screen.getByRole('button', { name: 'Open navigation' }),
  ).toHaveAttribute('aria-expanded', 'false');
});

test('desktop keeps direct navigation and account actions', () => {
  mockDesktop = true;
  render(shell);
  const modules = within(
    screen.getByRole('navigation', { name: 'Portal modules', hidden: true }),
  );
  expect(modules.getAllByRole('link', { hidden: true })).toHaveLength(
    portalModules.length,
  );
  expect(modules.getAllByRole('link', { hidden: true })[0]).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(
    screen.queryByRole('button', { name: 'Open navigation' }),
  ).not.toBeInTheDocument();
});

test.each(['signed out', 'login page'])(
  'navigation stays hidden on %s',
  (state) => {
    if (state === 'signed out') mockUser = null;
    else mockPathname = '/login';
    render(shell);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Page content' }),
    ).toBeInTheDocument();
  },
);
