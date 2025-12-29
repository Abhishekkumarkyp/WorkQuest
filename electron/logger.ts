import fs from 'fs';
import path from 'path';

export interface Logger {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export function createLogger(userDataPath: string): Logger {
  const logDir = path.join(userDataPath, 'logs');
  const logFile = path.join(logDir, 'app.log');

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  function write(level: 'INFO' | 'ERROR', message: string, meta?: unknown) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      meta: meta ?? null
    };
    fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`);
  }

  return {
    info(message, meta) {
      write('INFO', message, meta);
    },
    error(message, meta) {
      write('ERROR', message, meta);
    }
  };
}
