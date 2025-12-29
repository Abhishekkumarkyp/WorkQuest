import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
import type { Task, WorkLog } from '../shared/types';

export function createSeedData() {
  const now = dayjs();
  const task1Id = randomUUID();
  const task2Id = randomUUID();
  const task3Id = randomUUID();

  const tasks: Task[] = [
    {
      id: task1Id,
      title: 'Inbox Zero Kickoff',
      description: 'Clear backlog and tag quick wins for the week.',
      priority: 'High',
      status: 'Todo',
      dueDate: now.add(1, 'day').startOf('day').toISOString(),
      tags: ['Planning', 'Email'],
      estimateMinutes: 45,
      createdAt: now.subtract(2, 'day').toISOString(),
      updatedAt: now.subtract(2, 'day').toISOString()
    },
    {
      id: task2Id,
      title: 'Team Standup Notes',
      description: 'Summarize blockers and next steps in 5 bullets.',
      priority: 'Medium',
      status: 'Done',
      dueDate: now.subtract(1, 'day').startOf('day').toISOString(),
      tags: ['Comms', 'Daily'],
      estimateMinutes: 15,
      createdAt: now.subtract(1, 'day').toISOString(),
      updatedAt: now.subtract(1, 'day').add(2, 'hour').toISOString()
    },
    {
      id: task3Id,
      title: 'Focus Block: Report Draft',
      description: 'Draft the executive summary with 3 insights.',
      priority: 'High',
      status: 'InProgress',
      dueDate: now.add(2, 'day').startOf('day').toISOString(),
      tags: ['Writing', 'Deep Work'],
      estimateMinutes: 60,
      createdAt: now.subtract(3, 'day').toISOString(),
      updatedAt: now.subtract(1, 'hour').toISOString()
    }
  ];

  const logs: WorkLog[] = [
    {
      id: randomUUID(),
      date: now.subtract(1, 'day').format('YYYY-MM-DD'),
      taskId: task2Id,
      titleSnapshot: 'Team Standup Notes',
      timeSpentMinutes: 15,
      outcome: 'Notes shared with the team.',
      type: 'task',
      createdAt: now.subtract(1, 'day').add(2, 'hour').toISOString()
    },
    {
      id: randomUUID(),
      date: now.format('YYYY-MM-DD'),
      taskId: null,
      titleSnapshot: 'Focus Session',
      timeSpentMinutes: 25,
      outcome: 'Momentum unlocked.',
      type: 'focus',
      createdAt: now.subtract(3, 'hour').toISOString()
    }
  ];

  return { tasks, logs };
}
