export type Priority = 'Low' | 'Medium' | 'High';
export type Status = 'Todo' | 'InProgress' | 'Blocked' | 'Done';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  dueDate: string | null;
  tags: string[];
  estimateMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLog {
  id: string;
  date: string;
  taskId: string | null;
  titleSnapshot: string;
  timeSpentMinutes: number;
  outcome: string;
  type: 'task' | 'focus';
  createdAt: string;
}

export interface Settings {
  theme: 'glass' | 'light';
  notificationsEnabled: boolean;
  privacyLeaderboard: boolean;
}

export interface ExcelColumnMap {
  title: string;
  dueDate?: string;
  priority?: string;
  tags?: string;
  estimateMinutes?: string;
}

export interface ExcelImportRequest {
  action: 'pick' | 'preview' | 'import';
  filePath?: string;
  sheetName?: string;
  columnMap?: ExcelColumnMap;
}

export interface ExcelImportPreview {
  filePath: string;
  sheets: string[];
  sheetName: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
}

export interface ExcelImportResult {
  imported: number;
  skipped: number;
}

export type ExcelImportResponse =
  | { canceled: true }
  | { preview: ExcelImportPreview }
  | { result: ExcelImportResult };
