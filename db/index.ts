import type { Settings, Task, WorkLog } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { createSqliteRepository } from './sqlite';
import { createStoreRepository } from './store';

export interface Repository {
  listTasks(): Task[];
  getTask(id: string): Task | null;
  createTask(task: Task): Task;
  updateTask(task: Task): Task;
  deleteTask(id: string): void;
  listLogs(): WorkLog[];
  addLog(log: WorkLog): WorkLog;
  getSettings(): Settings;
  setSettings(partial: Partial<Settings>): Settings;
}

export interface AppLogger {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export function createRepository(userDataPath: string, logger: AppLogger): Repository {
  try {
    return createSqliteRepository(userDataPath, logger);
  } catch (error) {
    logger.error('SQLite unavailable, falling back to electron-store.', error);
    return createStoreRepository(userDataPath, DEFAULT_SETTINGS, logger);
  }
}
