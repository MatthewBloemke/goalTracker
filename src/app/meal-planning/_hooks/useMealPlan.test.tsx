import { act, renderHook, waitFor } from '@testing-library/react';
import { useMealPlan } from './useMealPlan';
import type { MealDraft, PlannedMeal } from '../_lib/meal-plan';

type Result = {
  data: PlannedMeal[] | { id: string }[] | null;
  error: { message: string } | null;
};
const methods = [
  'select',
  'gte',
  'lte',
  'order',
  'eq',
  'is',
  'insert',
  'update',
  'delete',
] as const;
type Query = Record<(typeof methods)[number], jest.Mock> & {
  then: Promise<Result>['then'];
};
let responses: (Result | Promise<Result>)[];
let queries: Query[];
const mockChannel = { on: jest.fn(), subscribe: jest.fn() };
const mockSupabase = {
  from: jest.fn(),
  channel: jest.fn(),
  removeChannel: jest.fn(),
};
const mockUser = { id: 'user' };
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ supabase: mockSupabase, user: mockUser }),
}));
const draft: MealDraft = {
  meal_date: '2026-10-25',
  meal_type: 'dinner',
  recipe_id: null,
  title: 'Soup',
  notes: '',
};
const meal: PlannedMeal = {
  ...draft,
  id: 'meal',
  user_id: 'user',
  family_id: 'family',
  created_at: '2026-10-20',
  updated_at: 'revision',
};
beforeEach(() => {
  jest.clearAllMocks();
  responses = [];
  queries = [];
  mockChannel.on.mockReturnValue(mockChannel);
  mockChannel.subscribe.mockReturnValue(mockChannel);
  mockSupabase.channel.mockReturnValue(mockChannel);
  mockSupabase.removeChannel.mockResolvedValue(undefined);
  mockSupabase.from.mockImplementation(() => {
    const promise = Promise.resolve(
      responses.shift() ?? { data: [], error: null },
    );
    const query = { then: promise.then.bind(promise) } as Query;
    for (const method of methods)
      query[method] = jest.fn().mockReturnValue(query);
    queries.push(query);
    return query;
  });
});
test('queries only the active family and requested visible dates', async () => {
  responses.push({ data: [meal], error: null });
  const { result } = renderHook(() =>
    useMealPlan('family', '2026-10-25', '2026-10-31'),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(queries[0].eq).toHaveBeenCalledWith('family_id', 'family');
  expect(queries[0].gte).toHaveBeenCalledWith('meal_date', '2026-10-25');
  expect(queries[0].lte).toHaveBeenCalledWith('meal_date', '2026-10-31');
  expect(result.current.meals).toEqual([meal]);
});
test('a missing family never queries or saves personal meal data', async () => {
  const { result } = renderHook(() =>
    useMealPlan(null, '2026-10-25', '2026-10-31'),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toContain('family');
  expect(queries).toHaveLength(0);
  await expect(result.current.save(draft)).rejects.toThrow('family');
  expect(queries).toHaveLength(0);
});
test('edits and deletions include the revision and reject stale writes', async () => {
  const { result } = renderHook(() =>
    useMealPlan('family', '2026-10-25', '2026-10-31'),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  responses.push({ data: [], error: null });
  await expect(result.current.save(draft, meal)).rejects.toThrow(
    'changed or was removed',
  );
  expect(queries[1].eq).toHaveBeenCalledWith('id', 'meal');
  expect(queries[1].eq).toHaveBeenCalledWith('updated_at', 'revision');
  expect(queries[1].update).toHaveBeenCalledWith(draft);
  await expect(result.current.remove(meal)).rejects.toThrow(
    'changed or was removed',
  );
  expect(queries[2].eq).toHaveBeenCalledWith('updated_at', 'revision');
});
test('database errors remain visible and invalid inputs never reach insert', async () => {
  responses.push({ data: null, error: { message: 'Offline' } });
  const { result } = renderHook(() =>
    useMealPlan('family', '2026-10-25', '2026-10-31'),
  );
  await waitFor(() => expect(result.current.error).toBe('Offline'));
  await expect(result.current.save({ ...draft, title: '' })).rejects.toThrow(
    'meal name',
  );
  expect(queries).toHaveLength(1);
  responses.push({ data: null, error: { message: 'Denied' } });
  await expect(result.current.save(draft)).rejects.toThrow('Denied');
});
test('a late response for a previous date range cannot replace the new range', async () => {
  let resolveOld!: (value: Result) => void;
  responses.push(
    new Promise<Result>((resolve) => {
      resolveOld = resolve;
    }),
  );
  const { result, rerender } = renderHook(
    ({ start }) => useMealPlan('family', start, start),
    { initialProps: { start: '2026-10-25' } },
  );
  await waitFor(() => expect(queries).toHaveLength(1));
  responses.push({ data: [{ ...meal, meal_date: '2026-11-01' }], error: null });
  rerender({ start: '2026-11-01' });
  await waitFor(() =>
    expect(result.current.meals[0]?.meal_date).toBe('2026-11-01'),
  );
  await act(async () => {
    resolveOld({ data: [meal], error: null });
  });
  expect(result.current.meals[0].meal_date).toBe('2026-11-01');
});
test('realtime changes refresh and subscription errors warn; unmount removes the subscription', async () => {
  const { result, unmount } = renderHook(() =>
    useMealPlan('family', '2026-10-25', '2026-10-31'),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  responses.push({ data: [meal], error: null });
  act(() => {
    mockChannel.on.mock.calls[0][2]();
  });
  await waitFor(() => expect(result.current.meals).toEqual([meal]));
  act(() => {
    mockChannel.subscribe.mock.calls[0][0]('CHANNEL_ERROR');
  });
  expect(result.current.realtimeError).toContain('disconnected');
  unmount();
  expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
});
