import dayjs from 'dayjs';
import type { Task, Priority } from '@shared/types';
import type { TodaySummaryPayload } from '@shared/lan-protocol';

const priorityRank: Record<Priority, number> = {
  High: 3,
  Medium: 2,
  Low: 1
};

const dueScore = (task: Task) => {
  if (!task.dueDate) return Number.POSITIVE_INFINITY;
  const now = dayjs();
  return Math.abs(dayjs(task.dueDate).diff(now, 'day'));
};

export const computeTodaySummary = (tasks: Task[]): TodaySummaryPayload => {
  const totalTasks = tasks.length;
  const doneCount = tasks.filter((task) => task.status === 'Done').length;
  const inProgressCount = tasks.filter((task) => task.status === 'InProgress').length;
  const blockedCount = tasks.filter((task) => task.status === 'Blocked').length;

  const activeTasks = tasks.filter((task) => task.status !== 'Done');
  const candidates = activeTasks.length ? activeTasks : tasks;

  const top3Titles = [...candidates]
    .sort((a, b) => {
      const priorityDiff = priorityRank[b.priority] - priorityRank[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const dueDiff = dueScore(a) - dueScore(b);
      if (dueDiff !== 0) return dueDiff;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 3)
    .map((task) => task.title);

  return {
    totalTasks,
    doneCount,
    inProgressCount,
    blockedCount,
    top3Titles
  };
};
