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
