import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { Repository, AppLogger } from './index';
import type { Settings, Task, WorkLog } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { createSeedData } from './seed';

export function createSqliteRepository(userDataPath: string, logger: AppLogger): Repository {
  let Database: any;
  try {
    Database = require('better-sqlite3');
  } catch (error) {
    throw error;
  }

  const dbPath = path.join(userDataPath, 'workquest.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const migrations = loadMigrations(logger);
  db.exec(migrations);

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, description, priority, status, dueDate, tags, estimateMinutes, createdAt, updatedAt)
    VALUES (@id, @title, @description, @priority, @status, @dueDate, @tags, @estimateMinutes, @createdAt, @updatedAt)
  `);

  const updateTask = db.prepare(`
    UPDATE tasks
    SET title = @title,
        description = @description,
        priority = @priority,
        status = @status,
        dueDate = @dueDate,
        tags = @tags,
        estimateMinutes = @estimateMinutes,
        updatedAt = @updatedAt
    WHERE id = @id
  `);

  const insertLog = db.prepare(`
    INSERT INTO logs (id, date, taskId, titleSnapshot, timeSpentMinutes, outcome, type, createdAt)
    VALUES (@id, @date, @taskId, @titleSnapshot, @timeSpentMinutes, @outcome, @type, @createdAt)
  `);

  const getSettingsRow = db.prepare('SELECT value FROM settings WHERE key = ?');
  const upsertSettings = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  if (taskCount.count === 0) {
    const seed = createSeedData();
    const insertMany = db.transaction((tasks: Task[], logs: WorkLog[]) => {
      tasks.forEach((task) => insertTask.run(serializeTask(task)));
      logs.forEach((log) => insertLog.run(log));
    });
    insertMany(seed.tasks, seed.logs);
    upsertSettings.run('settings', JSON.stringify(DEFAULT_SETTINGS));
  }

  return {
    listTasks() {
      const rows = db.prepare('SELECT * FROM tasks ORDER BY updatedAt DESC').all();
      return rows.map(deserializeTask);
    },
    getTask(id: string) {
      const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      return row ? deserializeTask(row) : null;
    },
    createTask(task: Task) {
      insertTask.run(serializeTask(task));
      return task;
    },
    updateTask(task: Task) {
      updateTask.run(serializeTask(task));
      return task;
    },
    deleteTask(id: string) {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    },
    listLogs() {
      const rows = db.prepare('SELECT * FROM logs ORDER BY createdAt DESC').all();
      return rows as WorkLog[];
    },
    addLog(log: WorkLog) {
      insertLog.run(log);
      return log;
    },
    getSettings() {
      const row = getSettingsRow.get('settings') as { value?: string } | undefined;
      if (!row?.value) {
        return DEFAULT_SETTINGS;
      }
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Settings) };
    },
    setSettings(partial: Partial<Settings>) {
      const current = this.getSettings();
      const next = { ...current, ...partial };
      upsertSettings.run('settings', JSON.stringify(next));
      return next;
    }
  };
}

function serializeTask(task: Task) {
  return {
    ...task,
    dueDate: task.dueDate ?? null,
    tags: JSON.stringify(task.tags ?? [])
  };
}

function deserializeTask(row: any): Task {
  return {
    ...row,
    dueDate: row.dueDate ?? null,
    tags: row.tags ? JSON.parse(row.tags) : []
  } as Task;
}

function loadMigrations(logger: AppLogger) {
  const appPath = app.getAppPath();
  const migrationsPath = path.join(appPath, 'db', 'migrations', '001_init.sql');
  try {
    return fs.readFileSync(migrationsPath, 'utf-8');
  } catch (error) {
    logger.error('Failed to read migrations, using fallback schema.', error);
    return `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        dueDate TEXT,
        tags TEXT,
        estimateMinutes INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        taskId TEXT,
        titleSnapshot TEXT NOT NULL,
        timeSpentMinutes INTEGER,
        outcome TEXT,
        type TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `;
  }
}
