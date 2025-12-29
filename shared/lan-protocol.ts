export const LAN_SERVICE_TYPE = 'workquest';
export const LAN_SERVICE_PROTOCOL = 'tcp';
export const LAN_APP_NAME = 'WorkQuest';
export const LAN_PROTOCOL_VERSION = '1';

export interface HelloPayload {
  app: string;
  device: string;
  v: string;
}

export interface TodaySummaryPayload {
  totalTasks: number;
  doneCount: number;
  inProgressCount: number;
  blockedCount: number;
  top3Titles: string[];
}

export interface ChatMessagePayload {
  id: string;
  text: string;
  sentAt: string;
  from: {
    name: string;
    port: number;
  };
}

export interface LanChatMessageEvent {
  peerId: string;
  message: ChatMessagePayload;
}

export interface LanPeer {
  id: string;
  name: string;
  host: string;
  port: number;
  lastSeen: string;
}

export interface LanManualPeerInput {
  name?: string;
  host: string;
  port: number;
}

export interface LanStartResult {
  port: number;
  deviceName: string;
}

export interface LanSignalMeta {
  name: string;
  port: number;
}

export interface LanFileMeta {
  id: string;
  name: string;
  size: number;
  mime?: string;
}

export interface LanFileReceivedEvent {
  peerId: string;
  name: string;
  size: number;
  filePath: string;
}

export interface LanChatAckEvent {
  peerId: string;
  messageId: string;
}

export interface LanFileAckEvent {
  peerId: string;
  fileId: string;
}

export type LanMessage =
  | { type: 'HELLO'; payload: HelloPayload }
  | { type: 'HELLO_OK'; payload: HelloPayload }
  | { type: 'REQUEST_TODAY_SUMMARY'; requestId: string }
  | { type: 'TODAY_SUMMARY'; requestId: string; payload: TodaySummaryPayload }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessagePayload }
  | { type: 'CHAT_ACK'; payload: { messageId: string; from?: LanSignalMeta } }
  | { type: 'FILE_OFFER'; payload: { file: LanFileMeta; from?: LanSignalMeta } }
  | { type: 'FILE_CHUNK'; payload: { fileId: string; index: number; total: number; data: string; from?: LanSignalMeta } }
  | { type: 'FILE_COMPLETE'; payload: { fileId: string; from?: LanSignalMeta } }
  | { type: 'FILE_ACK'; payload: { fileId: string; from?: LanSignalMeta } }
  | { type: 'CALL_OFFER'; payload: { sdp: any; callId: string; from?: LanSignalMeta } }
  | { type: 'CALL_ANSWER'; payload: { sdp: any; callId: string; from?: LanSignalMeta } }
  | { type: 'ICE_CANDIDATE'; payload: { candidate: any; callId: string; from?: LanSignalMeta } }
  | { type: 'CALL_END'; payload: { callId: string; reason?: string; from?: LanSignalMeta } }
  | { type: 'PING' }
  | { type: 'PONG' };
