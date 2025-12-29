import { app, BrowserWindow, clipboard, dialog, ipcMain, Notification, session, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import { createRepository } from '../db';
import type { Repository } from '../db';
import { createLogger } from './logger';
import { createTray } from './tray';
import { LanPocManager } from './lan/lanPocManager';
import type {
  ExcelImportPreview,
  ExcelImportRequest,
  ExcelImportResponse,
  ExcelImportResult,
  ExcelColumnMap,
  Settings,
  Task,
  WorkLog
} from '../shared/types';
import type { LanManualPeerInput } from '../shared/lan-protocol';
import { APP_NAME } from '../shared/constants';

let mainWindow: BrowserWindow | null = null;
let repository: Repository;
let logger: ReturnType<typeof createLogger>;
let isQuitting = false;
let tray: ReturnType<typeof createTray> | null = null;
let lanManager: LanPocManager | null = null;

app.setAppUserModelId('com.workquest.desktop');

function createMainWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(app.getAppPath(), 'assets', 'icon.ico')
    : path.join(app.getAppPath(), 'assets', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0B0C10',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

function registerIpc() {
  const handle = (channel: string, handler: (...args: any[]) => any) => {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (error) {
        logger.error(`IPC error: ${channel}`, error);
        throw error;
      }
    });
  };

  const ensureLanManager = () => {
    if (!lanManager) {
      throw new Error('LAN manager not ready.');
    }
    return lanManager;
  };

  handle('tasks:list', () => repository.listTasks());

  handle('tasks:create', (_event, task: Task) => {
    repository.createTask(task);
    return task;
  });

  handle('tasks:update', (_event, task: Task) => {
    const previous = repository.getTask(task.id);
    const updated = repository.updateTask(task);
    let log: WorkLog | null = null;

    if (previous && previous.status !== 'Done' && task.status === 'Done') {
      log = {
        id: randomUUID(),
        date: dayjs().format('YYYY-MM-DD'),
        taskId: task.id,
        titleSnapshot: task.title,
        timeSpentMinutes: task.estimateMinutes,
        outcome: 'Task completed.',
        type: 'task',
        createdAt: new Date().toISOString()
      };
      repository.addLog(log);
      maybeNotify(`Nice work! You completed "${task.title}".`);
    }

    return { task: updated, log };
  });

  handle('tasks:delete', (_event, id: string) => {
    repository.deleteTask(id);
  });

  handle('logs:list', () => repository.listLogs());

  handle('logs:add', (_event, log: WorkLog) => {
    repository.addLog(log);
    if (log.type === 'focus') {
      maybeNotify('Focus session complete. +1 point.');
    }
    return log;
  });

  handle('excel:import', async (_event, request: ExcelImportRequest): Promise<ExcelImportResponse> => {
    if (!request || request.action === 'pick') {
      const result = await dialog.showOpenDialog({
        title: 'Import Tasks',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        properties: ['openFile']
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }
      const preview = await buildPreview(result.filePaths[0]);
      return { preview };
    }

    if (request.action === 'preview' && request.filePath) {
      const preview = await buildPreview(request.filePath, request.sheetName);
      return { preview };
    }

    if (request.action === 'import' && request.filePath && request.sheetName && request.columnMap) {
      const result = await importFromExcel(request.filePath, request.sheetName, request.columnMap);
      return { result };
    }

    return { canceled: true };
  });

  handle('excel:exportTasks', async () => {
    const filePath = await pickSavePath('tasks.xlsx');
    if (!filePath) return { canceled: true };

    const tasks = repository.listTasks();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tasks');
    sheet.columns = [
      { header: 'Title', key: 'title', width: 32 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Due Date', key: 'dueDate', width: 18 },
      { header: 'Tags', key: 'tags', width: 24 },
      { header: 'Estimate (min)', key: 'estimateMinutes', width: 16 }
    ];

    tasks.forEach((task) => {
      sheet.addRow({
        ...task,
        dueDate: task.dueDate ? dayjs(task.dueDate).format('YYYY-MM-DD') : '',
        tags: task.tags.join(', ')
      });
    });

    await workbook.xlsx.writeFile(filePath);
    return { filePath };
  });

  handle('excel:exportDaily', async (_event, date: string) => {
    const fileName = `report_${date}.xlsx`;
    const filePath = await pickSavePath(fileName);
    if (!filePath) return { canceled: true };

    const logs = repository.listLogs().filter((log) => log.date === date && log.type === 'task');
    const tasks = repository.listTasks();
    const taskLookup = new Map(tasks.map((task) => [task.id, task]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Daily Report');

    sheet.addRow(['WorkQuest Daily Report']);
    sheet.addRow([`Date: ${date}`]);
    sheet.addRow([`Completed Tasks: ${logs.length}`]);
    sheet.addRow([]);
    sheet.addRow(['Title', 'Outcome', 'Time Spent (min)', 'Priority']);

    logs.forEach((log) => {
      const task = log.taskId ? taskLookup.get(log.taskId) : null;
      sheet.addRow([
        log.titleSnapshot,
        log.outcome,
        log.timeSpentMinutes,
        task?.priority ?? 'Medium'
      ]);
    });

    await workbook.xlsx.writeFile(filePath);
    return { filePath };
  });

  handle('share:copyText', (_event, text: string) => {
    clipboard.writeText(text);
    return { success: true };
  });

  handle('share:saveImage', async (_event, payload: { dataUrl: string; fileName?: string }) => {
    const downloads = app.getPath('downloads');
    const fileName = payload.fileName ?? `workquest_${dayjs().format('YYYY-MM-DD')}.png`;
    const filePath = path.join(downloads, fileName);
    const base64Data = payload.dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
    await fs.promises.writeFile(filePath, base64Data, 'base64');
    return { filePath };
  });

  handle('settings:get', () => repository.getSettings());

  handle('settings:set', (_event, partial: Partial<Settings>) => repository.setSettings(partial));

  handle('lan:start', () => ensureLanManager().start());
  handle('lan:stop', () => ensureLanManager().stop());
  handle('lan:peers', () => ensureLanManager().peers());
  handle('lan:refresh', () => ensureLanManager().refreshPeers());
  handle('lan:ping', (_event, peerId: string) => ensureLanManager().ping(peerId));
  handle('lan:getTodaySummary', (_event, peerId: string) =>
    ensureLanManager().getTodaySummary(peerId)
  );
  handle('lan:sendChat', (_event, peerId: string, text: string) =>
    ensureLanManager().sendChat(peerId, text)
  );
  handle('lan:pickFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select file to send',
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });
  handle('lan:sendFile', (_event, peerId: string, filePath: string) =>
    ensureLanManager().sendFile(peerId, filePath)
  );
  handle('lan:addManualPeer', (_event, peer: LanManualPeerInput) =>
    ensureLanManager().addManualPeer(peer)
  );
  handle('lan:removeManualPeer', (_event, peerId: string) =>
    ensureLanManager().removeManualPeer(peerId)
  );

  handle('lan:sendSignaling', (_event, peerId: string, type: any, payload: any) =>
    ensureLanManager().sendSignaling(peerId, type, payload)
  );

  handle('notification:show', (_event, title: string, body: string, payload?: any) => {
    if (!Notification.isSupported()) return;
    const notification = new Notification({ title, body });
    if (payload) {
      notification.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.webContents.send('notification:click', payload);
        }
      });
    }
    notification.show();
  });

  handle('shell:showItemInFolder', (_event, filePath: string) => {
    if (!filePath) return;
    shell.showItemInFolder(filePath);
  });
}

function maybeNotify(body: string) {
  const settings = repository.getSettings();
  if (!settings.notificationsEnabled || !Notification.isSupported()) return;
  const notification = new Notification({ title: APP_NAME, body });
  notification.show();
}

async function buildPreview(filePath: string, sheetName?: string): Promise<ExcelImportPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheets = workbook.worksheets.map((sheet) => sheet.name);
  const selectedSheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];

  if (!selectedSheet) {
    throw new Error('No worksheet found in file.');
  }

  const headers = extractHeaders(selectedSheet);
  const rows = extractRows(selectedSheet, 10);

  return {
    filePath,
    sheets,
    sheetName: selectedSheet.name,
    headers,
    rows
  };
}

async function importFromExcel(filePath: string, sheetName: string, columnMap: ExcelColumnMap): Promise<ExcelImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    throw new Error('Selected worksheet not found.');
  }

  const headers = extractHeaders(sheet);
  const rows = extractRows(sheet, sheet.rowCount);
  const columnIndexes = mapColumns(headers, columnMap);
  const existingTasks = repository.listTasks();
  const existingKey = new Set(existingTasks.map((task) => `${task.title}::${task.dueDate ?? ''}`));

  let imported = 0;
  let skipped = 0;

  rows.forEach((row, index) => {
    if (index === 0) return;
    const title = getCellValue(row, columnIndexes.title);
    if (!title) {
      skipped += 1;
      return;
    }

    const dueDate = parseDate(getCellValue(row, columnIndexes.dueDate));
    const key = `${title}::${dueDate ?? ''}`;
    if (existingKey.has(key)) {
      skipped += 1;
      return;
    }

    const task: Task = {
      id: randomUUID(),
      title: title,
      description: '',
      priority: normalizePriority(getCellValue(row, columnIndexes.priority)),
      status: 'Todo',
      dueDate,
      tags: parseTags(getCellValue(row, columnIndexes.tags)),
      estimateMinutes: parseEstimate(getCellValue(row, columnIndexes.estimateMinutes)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    repository.createTask(task);
    existingKey.add(key);
    imported += 1;
  });

  return { imported, skipped };
}

function extractHeaders(sheet: ExcelJS.Worksheet) {
  const firstRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let i = 1; i <= sheet.columnCount; i += 1) {
    const cell = firstRow.getCell(i);
    const value = String(cell.value ?? '').trim();
    headers.push(value.length ? value : `Column ${i}`);
  }
  return headers;
}

function extractRows(sheet: ExcelJS.Worksheet, limit: number) {
  const rows: Array<Array<string | number | null>> = [];
  const maxRows = Math.min(limit, sheet.rowCount);
  for (let i = 1; i <= maxRows; i += 1) {
    const row = sheet.getRow(i);
    const values: Array<string | number | null> = [];
    for (let col = 1; col <= sheet.columnCount; col += 1) {
      const cell = row.getCell(col);
      if (cell.value instanceof Date) {
        values.push(cell.value.toISOString());
      } else if (typeof cell.value === 'object' && cell.value && 'text' in cell.value) {
        values.push(String((cell.value as any).text));
      } else {
        values.push((cell.value as any) ?? null);
      }
    }
    rows.push(values);
  }
  return rows;
}

function mapColumns(headers: string[], columnMap: ExcelColumnMap) {
  const normalize = (value?: string) => value?.trim() ?? '';
  const headerIndex = (header: string) => headers.findIndex((item) => item.toLowerCase() === header.toLowerCase());
  const fromColumn = (value?: string) => {
    const cleaned = normalize(value);
    if (!cleaned) return -1;
    const indexFromHeader = headerIndex(cleaned);
    if (indexFromHeader >= 0) return indexFromHeader;
    const letter = cleaned.toUpperCase();
    if (/^[A-Z]+$/.test(letter)) {
      return letter.charCodeAt(0) - 65;
    }
    return -1;
  };

  return {
    title: fromColumn(columnMap.title),
    dueDate: fromColumn(columnMap.dueDate),
    priority: fromColumn(columnMap.priority),
    tags: fromColumn(columnMap.tags),
    estimateMinutes: fromColumn(columnMap.estimateMinutes)
  };
}

function getCellValue(row: Array<string | number | null>, index: number) {
  if (index === undefined || index < 0) return '';
  return row[index] ?? '';
}

function normalizePriority(value: string | number | null) {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('high')) return 'High';
  if (raw.includes('low')) return 'Low';
  return 'Medium';
}

function parseTags(value: string | number | null) {
  if (!value) return [] as string[];
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseEstimate(value: string | number | null) {
  if (!value) return 30;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 30 : Math.max(0, parsed);
}

function parseDate(value: string | number | null) {
  if (!value) return null;
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function pickSavePath(defaultName: string) {
  const downloads = app.getPath('downloads');
  const result = await dialog.showSaveDialog({
    defaultPath: path.join(downloads, defaultName),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  return result.canceled ? null : result.filePath;
}

app.whenReady().then(() => {
  logger = createLogger(app.getPath('userData'));
  repository = createRepository(app.getPath('userData'), logger);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const isMediaRequest = permission === 'media' || permission === 'audioCapture' || permission === 'videoCapture';
    if (!isMediaRequest) {
      callback(false);
      return;
    }
    const url = webContents.getURL();
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const isDevServer = devUrl ? url.startsWith(devUrl) : false;
    const isFile = url.startsWith('file://');
    callback(isDevServer || isFile);
  });

  const window = createMainWindow();
  lanManager = new LanPocManager(window, logger);
  tray = createTray(window, () => {
    isQuitting = true;
  });

  registerIpc();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  lanManager?.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
