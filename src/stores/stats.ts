import { defineStore } from 'pinia';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { useTasksStore } from './tasks';
import { useLogsStore } from './logs';

dayjs.extend(isSameOrBefore);

export const useStatsStore = defineStore('stats', {
  getters: {
    points() {
      const tasksStore = useTasksStore();
      const logsStore = useLogsStore();
      let points = 0;
      const completedTasks = tasksStore.tasks.filter((task) => task.status === 'Done');
      points += completedTasks.length * 5;

      completedTasks.forEach((task) => {
        if (task.dueDate && dayjs(task.updatedAt).isSameOrBefore(dayjs(task.dueDate), 'day')) {
          points += 2;
        }
      });

      const focusSessions = logsStore.logs.filter((log) => log.type === 'focus').length;
      points += focusSessions;

      return points;
    },
    streak() {
      const logsStore = useLogsStore();
      const taskDates = new Set(
        logsStore.logs.filter((log) => log.type === 'task').map((log) => log.date)
      );

      let streak = 0;
      let cursor = dayjs();
      while (taskDates.has(cursor.format('YYYY-MM-DD'))) {
        streak += 1;
        cursor = cursor.subtract(1, 'day');
      }
      return streak;
    }
  }
});
