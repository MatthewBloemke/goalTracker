import { act, renderHook, waitFor } from '@testing-library/react';
import { useBudget } from './useBudget';
import type { BudgetCategory } from '@/types';

const familyId = 'family-a';
const group = { id: 'group-a', family_id: familyId, name: 'Home', is_system: false, user_id: 'user', sort_order: 0, archived_at: null, created_at: '', updated_at: '' };
const originalCategory: BudgetCategory = {
  id: 'electricity', group_id: group.id, name: 'Electricity', loan_id: null,
  include_in_receipt_scans: true, is_system: false, sort_order: 0, archived_at: null,
  created_at: '', updated_at: '',
};
let category: BudgetCategory;
let writeError: Error | null;
const mockWrites: Array<{ update: jest.Mock; eq: jest.Mock }> = [];
const mockChannel = { on: jest.fn(), subscribe: jest.fn() };
const mockSupabase = { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() };
const mockUser = { id: 'user' };

jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ supabase: mockSupabase, user: mockUser }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  category = { ...originalCategory };
  writeError = null;
  mockWrites.length = 0;
  mockChannel.on.mockReturnValue(mockChannel);
  mockChannel.subscribe.mockReturnValue(mockChannel);
  mockSupabase.channel.mockReturnValue(mockChannel);
  mockSupabase.removeChannel.mockResolvedValue(undefined);
  mockSupabase.from.mockImplementation((table: string) => {
    const readResult = {
      data: table === 'budget_groups' ? [group] : table === 'budget_categories' ? [category] : [],
      error: null,
    };
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'is', 'order', 'eq', 'lt', 'limit', 'gte']) {
      query[method] = jest.fn().mockReturnValue(query);
    }
    query.then = Promise.resolve(readResult).then.bind(Promise.resolve(readResult));
    query.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    query.update = jest.fn().mockImplementation((value: { include_in_receipt_scans: boolean }) => {
      mockWrites.push({ update: query.update as jest.Mock, eq: query.eq as jest.Mock });
      query.single = jest.fn().mockImplementation(async () => {
        if (!writeError) category = { ...category, ...value };
        return { data: writeError ? null : { id: category.id }, error: writeError };
      });
      return query;
    });
    return query;
  });
});

test('saves receipt preferences only for a visible family category and reloads the persisted value', async () => {
  const { result } = renderHook(() => useBudget({ familyId, month: '2026-11-01' }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    expect(await result.current.setReceiptScanningEnabled('electricity', false)).toBe(true);
  });
  expect(mockWrites).toHaveLength(1);
  expect(mockWrites[0].update).toHaveBeenCalledWith({ include_in_receipt_scans: false });
  expect(mockWrites[0].eq).toHaveBeenCalledWith('id', 'electricity');
  expect(mockWrites[0].eq).toHaveBeenCalledWith('group_id', group.id);
  expect(result.current.categories[0].include_in_receipt_scans).toBe(false);
});

test('rejects another family category and loan categories before updating', async () => {
  category = { ...category, loan_id: 'loan-id' };
  const { result } = renderHook(() => useBudget({ familyId, month: '2026-11-01' }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    expect(await result.current.setReceiptScanningEnabled('other-family-category', false)).toBe(false);
  });
  expect(result.current.error).toContain('active family');
  await act(async () => {
    expect(await result.current.setReceiptScanningEnabled('electricity', true)).toBe(false);
  });
  expect(result.current.error).toContain('Loan payments');
  expect(mockWrites).toHaveLength(0);
});

test('a failed update preserves the original preference and reports the error', async () => {
  const { result } = renderHook(() => useBudget({ familyId, month: '2026-11-01' }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  writeError = new Error('Update denied');
  await act(async () => {
    expect(await result.current.setReceiptScanningEnabled('electricity', false)).toBe(false);
  });
  expect(result.current.categories[0].include_in_receipt_scans).toBe(true);
  expect(result.current.error).toBe('Update denied');
});
