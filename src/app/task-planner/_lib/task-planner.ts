import type { TaskItem, TaskList } from '@/types';

export type TaskListSummary = TaskList & {
  taskCount: number;
  completedCount: number;
};

export interface TaskCompletion {
  list_id: string;
  completed_at: string | null;
}

export interface TaskSections {
  active: TaskItem[];
  completed: TaskItem[];
}

export function buildTaskListSummaries(
  lists: TaskList[],
  items: TaskCompletion[],
): TaskListSummary[] {
  const counts = new Map<
    string,
    { taskCount: number; completedCount: number }
  >();

  for (const item of items) {
    const current = counts.get(item.list_id) ?? {
      taskCount: 0,
      completedCount: 0,
    };
    current.taskCount += 1;
    if (item.completed_at) current.completedCount += 1;
    counts.set(item.list_id, current);
  }

  return lists.map((list) => ({
    ...list,
    ...(counts.get(list.id) ?? { taskCount: 0, completedCount: 0 }),
  }));
}

export function orderTaskItems(
  tasks: TaskItem[],
  orderedIds: string[],
): TaskItem[] | null {
  if (orderedIds.length !== tasks.length) return null;

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const reordered = orderedIds.map((id, index) => {
    const task = taskById.get(id);
    return task ? { ...task, sort_order: index } : null;
  });

  if (reordered.some((task) => task === null)) return null;
  if (new Set(orderedIds).size !== tasks.length) return null;
  return reordered as TaskItem[];
}

export function splitTaskItems(tasks: TaskItem[]): TaskSections {
  const active = tasks.filter((task) => !task.completed_at);
  const completed = tasks
    .filter((task) => task.completed_at)
    .sort((left, right) => {
      const completedDifference =
        Date.parse(right.completed_at ?? '') -
        Date.parse(left.completed_at ?? '');
      return completedDifference || right.sort_order - left.sort_order;
    });

  return { active, completed };
}
