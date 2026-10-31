import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FamilyPage from './page';
import type { useFamily as useFamilyHook } from '@/hooks/useFamily';

const mockReplace = jest.fn();
const mockUpdateFamilyName = jest.fn();
let mockFamilyState: ReturnType<typeof useFamilyHook>;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/hooks/useFamily', () => ({
  useFamily: () => mockFamilyState,
}));

function familyState(isAdmin = true): ReturnType<typeof useFamilyHook> {
  return {
    family: {
      id: 'family-1',
      name: 'The Smiths',
      invite_code: 'ABC12345',
      created_at: '2026-10-29T00:00:00Z',
      created_by: 'user-1',
    },
    members: [
      {
        id: 'membership-1',
        family_id: 'family-1',
        user_id: 'user-1',
        role: isAdmin ? 'admin' : 'member',
        joined_at: '2026-10-29T00:00:00Z',
        profiles: {
          id: 'profile-1',
          user_id: 'user-1',
          display_name: 'Alex Smith',
          avatar_url: null,
          theme_preference: 'system',
          created_at: '2026-10-29T00:00:00Z',
          updated_at: '2026-10-29T00:00:00Z',
        },
      },
    ],
    settings: null,
    isAdmin,
    loading: false,
    error: null,
    createFamily: jest.fn(),
    joinFamily: jest.fn(),
    updateFamilyName: mockUpdateFamilyName,
    leaveFamily: jest.fn(),
    updateStrategy: jest.fn(),
    updateExtraBudget: jest.fn(),
    removeMember: jest.fn(),
    promoteMember: jest.fn(),
    refetch: jest.fn(),
  };
}

beforeEach(() => {
  mockFamilyState = familyState();
  mockUpdateFamilyName.mockResolvedValue({ success: true });
});

test('makes family-name editing visible and saves a trimmed name for admins', async () => {
  render(<FamilyPage />);

  fireEvent.click(
    screen.getByRole('button', { name: 'Edit family name' }),
  );
  const nameInput = screen.getByRole('textbox', { name: 'Family name' });
  expect(nameInput).toHaveValue('The Smiths');

  fireEvent.change(nameInput, { target: { value: '  Smith Family  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

  await waitFor(() =>
    expect(mockUpdateFamilyName).toHaveBeenCalledWith('Smith Family'),
  );
  expect(screen.getByRole('status')).toHaveTextContent('Family name updated.');
  expect(
    screen.queryByRole('textbox', { name: 'Family name' }),
  ).not.toBeInTheDocument();
});

test('does not offer family-name editing to non-admin members', () => {
  mockFamilyState = familyState(false);
  render(<FamilyPage />);

  expect(
    screen.queryByRole('button', { name: 'Edit family name' }),
  ).not.toBeInTheDocument();
});

