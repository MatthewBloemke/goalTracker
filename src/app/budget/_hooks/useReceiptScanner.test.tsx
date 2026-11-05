import { act, renderHook } from '@testing-library/react';
import { useReceiptScanner } from './useReceiptScanner';
import type { BudgetCategory } from '@/types';

const mockInvoke = jest.fn();
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ supabase: { functions: { invoke: mockInvoke } } }),
}));
const category = (id: string, enabled: boolean, loanId: string | null = null): BudgetCategory => ({
  id, group_id: 'group', name: id, loan_id: loanId, include_in_receipt_scans: enabled,
  is_system: Boolean(loanId), sort_order: 0, archived_at: null, created_at: '', updated_at: '',
});
const image = { data: 'cGhvdG8=', mimeType: 'image/jpeg' as const, width: 1542, height: 2048 };
const analysis = {
  merchant: "Woodman's", transactionDate: '2026-11-04', subtotal: 22.47, tax: 0,
  discounts: null, tip: null, fees: null, total: 22.47, requiresReview: false,
  reviewReasons: [], items: [], allocations: [{ categoryId: 'groceries', amount: 22.47 }],
};

test('sends the approved preview bytes and only opted-in spending category IDs', async () => {
  mockInvoke.mockResolvedValue({ data: analysis, error: null });
  const { result } = renderHook(() => useReceiptScanner({
    familyId: 'family',
    categories: [category('groceries', true), category('electricity', false), category('mortgage', true, 'loan')],
  }));
  await act(async () => { await result.current.analyze(image); });
  expect(mockInvoke).toHaveBeenCalledWith('analyze-receipt', {
    body: {
      familyId: 'family', categoryIds: ['groceries'],
      receipt: { type: 'image', data: image.data, mimeType: image.mimeType },
    },
  });
  expect(result.current.analysis).toEqual(analysis);
});

test('no eligible categories prevents an OpenAI-bound request for every input path', async () => {
  const { result } = renderHook(() => useReceiptScanner({ familyId: 'family', categories: [category('electricity', false)] }));
  await act(async () => { await result.current.analyze(image); });
  await act(async () => { await result.current.analyzeText('Merchant: Store\nTotal: $22.47'); });
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(result.current.error).toContain('Edit groups');
});
