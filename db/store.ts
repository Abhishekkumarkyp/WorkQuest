import Store from 'electron-store';
import type { Repository, AppLogger } from './index';
import type { Settings, Task, WorkLog } from '../shared/types';
import { createSeedData } from './seed';

export function createStoreRepository(userDataPath: string, defaults: Settings, logger: AppLogger): Repository {
  const store = new Store({
    name: 'workquest',
    cwd: userDataPath,
    defaults: {
      tasks: [] as Task[],
      logs: [] as WorkLog[],
      settings: defaults
    }
  });

  const existingTasks = store.get('tasks') as Task[];
  if (!existingTasks || existingTasks.length === 0) {
    const seed = createSeedData();
    store.set('tasks', seed.tasks);
    store.set('logs', seed.logs);
  }

  return {
    listTasks() {
      return (store.get('tasks') as Task[]) ?? [];
    },
    getTask(id: string) {
      return ((store.get('tasks') as Task[]) ?? []).find((task) => task.id === id) ?? null;
    },
    createTask(task: Task) {
      const tasks = (store.get('tasks') as Task[]) ?? [];
      tasks.unshift(task);
      store.set('tasks', tasks);
      return task;
    },
    updateTask(task: Task) {
      const tasks = (store.get('tasks') as Task[]) ?? [];
      const index = tasks.findIndex((item) => item.id === task.id);
      if (index >= 0) {
        tasks[index] = task;
        store.set('tasks', tasks);
      } else {
        logger.error('Attempted to update missing task in store.', { id: task.id });
      }
      return task;
    },
    deleteTask(id: string) {
      const tasks = (store.get('tasks') as Task[]) ?? [];
      store.set('tasks', tasks.filter((task) => task.id !== id));
    },
    listLogs() {
      return (store.get('logs') as WorkLog[]) ?? [];
    },
    addLog(log: WorkLog) {
      const logs = (store.get('logs') as WorkLog[]) ?? [];
      logs.unshift(log);
      store.set('logs', logs);
      return log;
    },
    getSettings() {
      return (store.get('settings') as Settings) ?? defaults;
    },
    setSettings(partial: Partial<Settings>) {
      const current = (store.get('settings') as Settings) ?? defaults;
      const next = { ...current, ...partial };
      store.set('settings', next);
      return next;
    }
  };
}
