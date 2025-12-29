import { contextBridge, ipcRenderer } from 'electron';
import type {
  ExcelImportRequest,
  ExcelImportResponse,
  Settings,
  Task,
  WorkLog
} from '../shared/types';
import type {
  ChatMessagePayload,
  LanChatMessageEvent,
  LanChatAckEvent,
  LanFileAckEvent,
  LanManualPeerInput,
  LanPeer,
  LanStartResult,
  LanFileReceivedEvent,
  TodaySummaryPayload
} from '../shared/lan-protocol';

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
  };
  showNotification: (options: { title: string; body: string; payload?: any }) => void;
  onNotificationClick: (callback: (payload: any) => void) => () => void;
  showItemInFolder: (filePath: string) => void;
}

const electronAPI: ElectronAPI = {
  tasksList: () => ipcRenderer.invoke('tasks:list'),
  tasksCreate: (task) => ipcRenderer.invoke('tasks:create', task),
  tasksUpdate: (task) => ipcRenderer.invoke('tasks:update', task),
  tasksDelete: (id) => ipcRenderer.invoke('tasks:delete', id),
  logsList: () => ipcRenderer.invoke('logs:list'),
  logsAdd: (log) => ipcRenderer.invoke('logs:add', log),
  excelImport: (request) => ipcRenderer.invoke('excel:import', request),
  excelExportTasks: () => ipcRenderer.invoke('excel:exportTasks'),
  excelExportDaily: (date) => ipcRenderer.invoke('excel:exportDaily', date),
  shareCopyText: (text) => ipcRenderer.invoke('share:copyText', text),
  shareSaveImage: (dataUrl, fileName) => ipcRenderer.invoke('share:saveImage', { dataUrl, fileName }),
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (partial) => ipcRenderer.invoke('settings:set', partial),
  onTrayAddTask: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('tray:addTask', listener);
    return () => ipcRenderer.removeListener('tray:addTask', listener);
  },
  lan: {
    start: () => ipcRenderer.invoke('lan:start'),
    stop: () => ipcRenderer.invoke('lan:stop'),
    peers: () => ipcRenderer.invoke('lan:peers'),
    refresh: () => ipcRenderer.invoke('lan:refresh'),
    ping: (peerId) => ipcRenderer.invoke('lan:ping', peerId),
    getTodaySummary: (peerId) => ipcRenderer.invoke('lan:getTodaySummary', peerId),
    sendChat: (peerId, text) => ipcRenderer.invoke('lan:sendChat', peerId, text),
    pickFile: () => ipcRenderer.invoke('lan:pickFile'),
    sendFile: (peerId, filePath) => ipcRenderer.invoke('lan:sendFile', peerId, filePath),
    addManualPeer: (peer) => ipcRenderer.invoke('lan:addManualPeer', peer),
    removeManualPeer: (peerId) => ipcRenderer.invoke('lan:removeManualPeer', peerId),
    onRequestLocalSummary: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { requestId: string }) => {
        callback(payload.requestId);
      };
      ipcRenderer.on('lan:requestLocalSummary', listener);
      return () => ipcRenderer.removeListener('lan:requestLocalSummary', listener);
    },
    sendLocalSummary: (requestId, summary) =>
      ipcRenderer.send('lan:localSummary', { requestId, summary }),
    onChatMessage: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: LanChatMessageEvent) => {
        callback(payload);
      };
      ipcRenderer.on('lan:chatMessage', listener);
      return () => ipcRenderer.removeListener('lan:chatMessage', listener);
    },
    onChatAck: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: LanChatAckEvent) => {
        callback(payload);
      };
      ipcRenderer.on('lan:chatAck', listener);
      return () => ipcRenderer.removeListener('lan:chatAck', listener);
    },
    onPeersUpdated: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, peers: LanPeer[]) => {
        callback(peers);
      };
      ipcRenderer.on('lan:peersUpdated', listener);
      return () => ipcRenderer.removeListener('lan:peersUpdated', listener);
    },
    onFileReceived: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: LanFileReceivedEvent) => {
        callback(payload);
      };
      ipcRenderer.on('lan:fileReceived', listener);
      return () => ipcRenderer.removeListener('lan:fileReceived', listener);
    },
    onFileAck: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: LanFileAckEvent) => {
        callback(payload);
      };
      ipcRenderer.on('lan:fileAck', listener);
      return () => ipcRenderer.removeListener('lan:fileAck', listener);
    },
    sendSignaling: (peerId, type, payload) => ipcRenderer.invoke('lan:sendSignaling', peerId, type, payload),
    onSignaling: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: any) => {
        callback(payload);
      };
      ipcRenderer.on('lan:signaling', listener);
      return () => ipcRenderer.removeListener('lan:signaling', listener);
    }
  },
  showNotification: (options) => ipcRenderer.invoke('notification:show', options.title, options.body, options.payload),
  onNotificationClick: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => {
      callback(payload);
    };
    ipcRenderer.on('notification:click', listener);
    return () => ipcRenderer.removeListener('notification:click', listener);
  },
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath)
};


contextBridge.exposeInMainWorld('electronAPI', electronAPI);
