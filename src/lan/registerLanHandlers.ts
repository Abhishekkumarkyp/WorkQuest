import type { Pinia } from 'pinia';
import { useTasksStore } from '../stores/tasks';
import { computeTodaySummary } from './summary';

export const registerLanHandlers = (pinia: Pinia) => {
  const tasksStore = useTasksStore(pinia);
  return window.electronAPI.lan.onRequestLocalSummary((requestId) => {
    const summary = computeTodaySummary(tasksStore.tasks);
    window.electronAPI.lan.sendLocalSummary(requestId, summary);
  });
};
