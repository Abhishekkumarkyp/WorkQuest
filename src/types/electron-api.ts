import type { ExcelImportRequest, ExcelImportResponse, Settings, Task, WorkLog } from '@shared/types';
import type {
  ChatMessagePayload,
  LanChatMessageEvent,
  LanChatAckEvent,
  LanFileAckEvent,
  LanFileReceivedEvent,
  LanManualPeerInput,
  LanPeer,
  LanStartResult,
  TodaySummaryPayload
} from '@shared/lan-protocol';

export interface ElectronAPI {
  tasksList: () => Promise<Task[]>;
  tasksCreate: (task: Task) => Promise<Task>;
  tasksUpdate: (task: Task) => Promise<{ task: Task; log?: WorkLog | null }>;
  tasksDelete: (id: string) => Promise<void>;
  logsList: () => Promise<WorkLog[]>;
  logsAdd: (log: WorkLog) => Promise<WorkLog>;
  excelImport: (request: ExcelImportRequest) => Promise<ExcelImportResponse>;
  excelExportTasks: () => Promise<{ canceled?: boolean; filePath?: string }>;
  excelExportDaily: (date: string) => Promise<{ canceled?: boolean; filePath?: string }>;
  shareCopyText: (text: string) => Promise<{ success: boolean }>;
  shareSaveImage: (dataUrl: string, fileName?: string) => Promise<{ filePath: string }>;
  settingsGet: () => Promise<Settings>;
  settingsSet: (partial: Partial<Settings>) => Promise<Settings>;
  onTrayAddTask: (callback: () => void) => () => void;
  lan: {
    start: () => Promise<LanStartResult>;
    stop: () => Promise<void>;
    peers: () => Promise<LanPeer[]>;
    refresh: () => Promise<LanPeer[]>;
    ping: (peerId: string) => Promise<void>;
    getTodaySummary: (peerId: string) => Promise<TodaySummaryPayload>;
    sendChat: (peerId: string, text: string) => Promise<ChatMessagePayload>;
    pickFile: () => Promise<{ canceled: boolean; filePath?: string }>;
    sendFile: (peerId: string, filePath: string) => Promise<{ id: string; name: string; size: number; mime?: string }>;
    addManualPeer: (peer: LanManualPeerInput) => Promise<LanPeer>;
    removeManualPeer: (peerId: string) => Promise<void>;
    onRequestLocalSummary: (callback: (requestId: string) => void) => () => void;
    sendLocalSummary: (requestId: string, summary: TodaySummaryPayload) => void;
    onChatMessage: (callback: (event: LanChatMessageEvent) => void) => () => void;
    onChatAck: (callback: (event: LanChatAckEvent) => void) => () => void;
    onPeersUpdated: (callback: (peers: LanPeer[]) => void) => () => void;
    onFileReceived: (callback: (event: LanFileReceivedEvent) => void) => () => void;
    onFileAck: (callback: (event: LanFileAckEvent) => void) => () => void;
    sendSignaling: (peerId: string, type: string, payload: any) => Promise<void>;
    onSignaling: (callback: (event: { peerId: string; type: string; payload: any }) => void) => () => void;
  };
  showNotification: (options: { title: string; body: string; payload?: any }) => void;
  onNotificationClick: (callback: (payload: any) => void) => () => void;
  showItemInFolder: (filePath: string) => void;
}
