import { renderHook, waitFor } from '@testing-library/react';
import { useFamilyState } from './useFamily';

let mockUser: { id: string } | null = { id: 'user-1' };
let mockAuthLoading = false;
const mockMaybeSingle = jest.fn();
const mockRemoveChannel = jest.fn();
const mockQuery: Record<string, jest.Mock> = {};
mockQuery.select = jest.fn(() => mockQuery);
mockQuery.eq = jest.fn(() => mockQuery);
mockQuery.maybeSingle = mockMaybeSingle;
const mockChannel: Record<string, jest.Mock> = {};
mockChannel.on = jest.fn(() => mockChannel);
mockChannel.subscribe = jest.fn(() => mockChannel);
const mockSupabase = {
  from: jest.fn(() => mockQuery),
  channel: jest.fn(() => mockChannel),
  removeChannel: mockRemoveChannel,
};

jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({
    supabase: mockSupabase,
    user: mockUser,
    loading: mockAuthLoading,
  }),
}));

beforeEach(() => {
  mockUser = { id: 'user-1' };
  mockAuthLoading = false;
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
});

test('resolves membership per user ID without reloading for a refreshed user object', async () => {
  const { result, rerender } = renderHook(() => useFamilyState());
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockMaybeSingle).toHaveBeenCalledTimes(1);

  mockUser = { id: 'user-1' };
  rerender();
  expect(result.current.loading).toBe(false);
  expect(mockMaybeSingle).toHaveBeenCalledTimes(1);

  mockUser = { id: 'user-2' };
  rerender();
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
});

test('revalidates membership on focus without entering a loading state', async () => {
  const { result } = renderHook(() => useFamilyState());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockMaybeSingle).toHaveBeenCalledTimes(1);

  window.dispatchEvent(new Event('focus'));
  expect(result.current.loading).toBe(false);
  await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalledTimes(2));
  expect(result.current.loading).toBe(false);
});
