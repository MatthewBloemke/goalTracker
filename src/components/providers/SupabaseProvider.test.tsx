import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { SupabaseProvider, useSupabase } from './SupabaseProvider';

const mockGetUser = jest.fn();
const mockUnsubscribe = jest.fn();
let mockAuthCallback:
  | ((event: AuthChangeEvent, session: Session | null) => void)
  | null = null;
const mockClient = {
  auth: {
    getUser: mockGetUser,
    onAuthStateChange: jest.fn((callback) => {
      mockAuthCallback = callback;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    }),
  },
};

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => mockClient,
}));

const user = (id: string) => ({ id }) as User;
const session = (nextUser: User) => ({ user: nextUser }) as Session;

let observedUser: User | null = null;
function AuthConsumer() {
  const { user: currentUser, loading } = useSupabase();
  useEffect(() => {
    observedUser = currentUser;
  }, [currentUser]);
  return <div>{loading ? 'Loading' : currentUser?.id ?? 'Signed out'}</div>;
}

beforeEach(() => {
  observedUser = null;
  mockAuthCallback = null;
  mockGetUser.mockResolvedValue({ data: { user: user('user-1') }, error: null });
});

test('keeps the same user identity during background token refreshes', async () => {
  render(
    <SupabaseProvider>
      <AuthConsumer />
    </SupabaseProvider>,
  );
  await waitFor(() => expect(screen.getByText('user-1')).toBeInTheDocument());
  const initialUser = observedUser;

  act(() => {
    mockAuthCallback?.('TOKEN_REFRESHED', session(user('user-1')));
  });
  expect(observedUser).toBe(initialUser);

  act(() => {
    mockAuthCallback?.('SIGNED_IN', session(user('user-2')));
  });
  expect(screen.getByText('user-2')).toBeInTheDocument();
  expect(observedUser).not.toBe(initialUser);
});
