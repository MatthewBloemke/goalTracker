import { renderHook, waitFor } from '@testing-library/react';
import { useLoans } from './useLoans';

const mockUseSupabase = jest.fn();

jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => mockUseSupabase(),
}));

function createSupabaseMock() {
  const query = {
    data: [],
    error: null,
    select: jest.fn(),
    order: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);

  const realtimeChannel = {
    on: jest.fn(),
    subscribe: jest.fn(),
  };
  realtimeChannel.on.mockReturnValue(realtimeChannel);
  realtimeChannel.subscribe.mockReturnValue(realtimeChannel);

  const supabase = {
    from: jest.fn().mockReturnValue(query),
    channel: jest.fn().mockReturnValue(realtimeChannel),
    removeChannel: jest.fn(),
  };

  return { query, supabase };
}

describe('useLoans budget scope', () => {
  test('loads only personal loans when there is no active family', async () => {
    const { query, supabase } = createSupabaseMock();
    mockUseSupabase.mockReturnValue({
      supabase,
      user: { id: 'user-1' },
    });

    renderHook(() => useLoans());

    await waitFor(() => {
      expect(query.is).toHaveBeenCalledWith('family_id', null);
      expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  test('loads the shared budget loans when a family is active', async () => {
    const { query, supabase } = createSupabaseMock();
    mockUseSupabase.mockReturnValue({
      supabase,
      user: { id: 'user-1' },
    });

    renderHook(() => useLoans({ familyId: 'family-1' }));

    await waitFor(() => {
      expect(query.eq).toHaveBeenCalledWith('family_id', 'family-1');
    });
    expect(query.is).not.toHaveBeenCalled();
    expect(query.eq).not.toHaveBeenCalledWith('user_id', 'user-1');
  });
});
