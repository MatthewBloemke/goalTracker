import {
  buildTaskListSummaries,
  orderTaskItems,
} from '@/app/task-planner/_lib/task-planner';
import type { TaskItem, TaskList } from '@/types';

const list = (id: string): TaskList => ({
  id,
  user_id: 'user-1',
  family_id: null,
  name: `List ${id}`,
  created_at: '2026-10-09T12:00:00.000Z',
  updated_at: '2026-10-09T12:00:00.000Z',
});

const task = (id: string, sortOrder: number): TaskItem => ({
  id,
  list_id: 'list-1',
  created_by: 'user-1',
  name: `Task ${id}`,
  notes: null,
  sort_order: sortOrder,
  completed_at: null,
  created_at: '2026-10-09T12:00:00.000Z',
  updated_at: '2026-10-09T12:00:00.000Z',
});

describe('task planner list summaries', () => {
  test('counts total and completed tasks per list', () => {
    expect(
      buildTaskListSummaries([list('a'), list('b')], [
        { list_id: 'a', completed_at: null },
        { list_id: 'a', completed_at: '2026-10-09T13:00:00.000Z' },
      ]),
    ).toEqual([
      expect.objectContaining({ id: 'a', taskCount: 2, completedCount: 1 }),
      expect.objectContaining({ id: 'b', taskCount: 0, completedCount: 0 }),
    ]);
  });
});

describe('task planner ordering', () => {
  test('returns tasks in the requested order with normalized positions', () => {
    const tasks = [task('a', 0), task('b', 1), task('c', 2)];

    expect(orderTaskItems(tasks, ['c', 'a', 'b'])).toEqual([
      expect.objectContaining({ id: 'c', sort_order: 0 }),
      expect.objectContaining({ id: 'a', sort_order: 1 }),
      expect.objectContaining({ id: 'b', sort_order: 2 }),
    ]);
  });

  test('rejects missing, duplicate, or unknown task IDs', () => {
    const tasks = [task('a', 0), task('b', 1)];

    expect(orderTaskItems(tasks, ['a'])).toBeNull();
    expect(orderTaskItems(tasks, ['a', 'a'])).toBeNull();
    expect(orderTaskItems(tasks, ['a', 'unknown'])).toBeNull();
  });
});
