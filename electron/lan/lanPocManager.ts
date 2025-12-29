import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import type { Logger } from '../logger';
import type {
  ChatMessagePayload,
  LanChatMessageEvent,
  LanFileMeta,
  LanFileReceivedEvent,
  LanChatAckEvent,
  LanFileAckEvent,
  LanManualPeerInput,
  LanPeer,
  LanStartResult,
  LanSignalMeta,
  TodaySummaryPayload
} from '@shared/lan-protocol';
import { LanDiscovery } from './discovery';
import { LanWsServer } from './wsServer';
import { LanWsClient } from './wsClient';
import { LAN_APP_NAME, LAN_PROTOCOL_VERSION } from '@shared/lan-protocol';

const CONNECT_TIMEOUT_MS = 5000;
const FILE_CONNECT_TIMEOUT_MS = 10000;
const FILE_CHUNK_SIZE = 64 * 1024;
const LOCAL_SUMMARY_TIMEOUT_MS = 3000;

export class LanPocManager {
  private discovery: LanDiscovery | null = null;
  private wsServer: LanWsServer | null = null;
  private wsClient: LanWsClient;
  private deviceName = os.hostname();
  private manualPeers = new Map<string, LanPeer>();
  private incomingFiles = new Map<
    string,
    {
      stream: fs.WriteStream;
      filePath: string;
      size: number;
      received: number;
      name: string;
      peerId: string;
      address: string;
      port: number;
    }
  >();
  private pendingSummaryRequests = new Map<
    string,
    { resolve: (summary: TodaySummaryPayload) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  >();

  constructor(
    private mainWindow: BrowserWindow,
    private logger: Logger
  ) {
    const helloPayload = {
      type: 'HELLO' as const,
      payload: {
        app: LAN_APP_NAME,
        device: this.deviceName,
        v: LAN_PROTOCOL_VERSION
      }
    };
    this.wsClient = new LanWsClient(helloPayload);
    ipcMain.on('lan:localSummary', (_event, payload: { requestId: string; summary: TodaySummaryPayload }) => {
      this.resolveLocalSummary(payload.requestId, payload.summary);
    });
  }

  async start(): Promise<LanStartResult> {
    if (this.wsServer) {
      return { port: this.wsServer.getPort(), deviceName: this.deviceName };
    }
    const helloPayload = {
      app: LAN_APP_NAME,
      device: this.deviceName,
      v: LAN_PROTOCOL_VERSION
    };
    this.wsServer = new LanWsServer(
      helloPayload,
      () => this.requestLocalSummary(),
      (payload, from) => this.handleChatMessage(payload, from),
      (type, from, payload) => this.handleFileMessage(type, from, payload),
      (type, from, payload) => this.handleAckMessage(type, from, payload),
      (type: string, from: { address: string; port: number }, payload: any) => this.handleSignaling(type, from, payload),
      (message, error) => this.logger.error(message, error)
    );
    const port = await this.wsServer.start();
    this.discovery = new LanDiscovery(this.deviceName, port, (discovered) => {
      const merged = this.mergePeers(discovered);
      this.mainWindow.webContents.send('lan:peersUpdated', merged);
    });
    this.discovery.start();
    return { port, deviceName: this.deviceName };
  }

  async stop() {
    this.discovery?.stop();
    this.discovery = null;
    this.wsServer?.stop();
    this.wsServer = null;
    this.incomingFiles.forEach((entry) => {
      try {
        entry.stream.close();
      } catch {
        // ignore
      }
    });
    this.incomingFiles.clear();
    this.pendingSummaryRequests.forEach((pending) => {
      clearTimeout(pending.timer);
      pending.reject(new Error('LAN stopped.'));
    });
    this.pendingSummaryRequests.clear();
  }

  peers(): LanPeer[] {
    return this.mergePeers(this.discovery?.listPeers() ?? []);
  }

  refreshPeers(): LanPeer[] {
    const discovered = this.discovery?.refresh() ?? [];
    return this.mergePeers(discovered);
  }

  async ping(peerId: string) {
    const peer = this.getPeer(peerId);
    await this.wsClient.ping(peer, CONNECT_TIMEOUT_MS);
  }

  async getTodaySummary(peerId: string) {
    const peer = this.getPeer(peerId);
    const requestId = randomUUID();
    return this.wsClient.requestSummary(peer, requestId, CONNECT_TIMEOUT_MS);
  }

  async sendChat(peerId: string, text: string): Promise<ChatMessagePayload> {
    const peer = this.getPeer(peerId);
    if (!this.wsServer) {
      throw new Error('LAN not started.');
    }
    const payload: ChatMessagePayload = {
      id: randomUUID(),
      text,
      sentAt: new Date().toISOString(),
      from: {
        name: this.deviceName,
        port: this.wsServer.getPort()
      }
    };
    await this.wsClient.sendChat(peer, payload, CONNECT_TIMEOUT_MS);
    return payload;
  }

  async sendFile(peerId: string, filePath: string): Promise<LanFileMeta> {
    const peer = this.getPeer(peerId);
    if (!this.wsServer) {
      throw new Error('LAN not started.');
    }
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      throw new Error('Selected item is not a file.');
    }
    const name = path.basename(filePath);
    const file: LanFileMeta = {
      id: randomUUID(),
      name,
      size: stat.size,
      mime: this.guessMimeType(name)
    };
    const fromMeta: LanSignalMeta = { name: this.deviceName, port: this.wsServer.getPort() };
    await this.wsClient.sendFile(peer, file, filePath, fromMeta, FILE_CHUNK_SIZE, FILE_CONNECT_TIMEOUT_MS);
    return file;
  }

  addManualPeer(input: LanManualPeerInput): LanPeer {
    const host = input.host.trim();
    const port = Number(input.port);
    if (!host) {
      throw new Error('Host is required.');
    }
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      throw new Error('Invalid port.');
    }
    const name = input.name?.trim() || host;
    const id = `manual::${host}:${port}`;
    const peer: LanPeer = {
      id,
      name,
      host,
      port,
      lastSeen: new Date().toISOString()
    };
    this.manualPeers.set(id, peer);
    return peer;
  }

  async sendSignaling(peerId: string, type: 'CALL_OFFER' | 'CALL_ANSWER' | 'ICE_CANDIDATE' | 'CALL_END', payload: any) {
    const peer = this.getPeer(peerId);
    if (!this.wsServer) {
      throw new Error('LAN not started.');
    }
    const fromMeta = { name: this.deviceName, port: this.wsServer.getPort() };
    const payloadWithFrom = { ...payload, from: fromMeta };
    console.log(`[LanPocManager] Sending signaling ${type} to ${peer.host}:${peer.port}`);
    return this.wsClient.sendMessage(peer.host, peer.port, { type, payload: payloadWithFrom } as any);
  }

  removeManualPeer(peerId: string) {
    this.manualPeers.delete(peerId);
  }

  private getPeer(peerId: string) {
    const peer = this.manualPeers.get(peerId) ?? this.discovery?.getPeer(peerId);
    if (!peer) {
      throw new Error('Peer not found.');
    }
    return peer;
  }

  private mergePeers(discovered: LanPeer[]) {
    const manual = Array.from(this.manualPeers.values()).filter((peer) => {
      return !discovered.some((known) => known.host === peer.host && known.port === peer.port);
    });
    return [...discovered, ...manual].sort((a, b) => a.name.localeCompare(b.name));
  }

  private requestLocalSummary() {
    const requestId = randomUUID();
    return new Promise<TodaySummaryPayload>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingSummaryRequests.delete(requestId);
        reject(new Error('Local summary timed out.'));
      }, LOCAL_SUMMARY_TIMEOUT_MS);
      this.pendingSummaryRequests.set(requestId, { resolve, reject, timer });
      this.mainWindow.webContents.send('lan:requestLocalSummary', { requestId });
    });
  }

  private resolveLocalSummary(requestId: string, summary: TodaySummaryPayload) {
    const pending = this.pendingSummaryRequests.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.resolve(summary);
    this.pendingSummaryRequests.delete(requestId);
  }

  private handleChatMessage(payload: ChatMessagePayload, from: { address: string }) {
    const upserted = this.upsertPeerFromIncoming(payload.from.name, from.address, payload.from.port);
    if (upserted?.added) {
      this.mainWindow.webContents.send('lan:peersUpdated', this.mergePeers(this.discovery?.listPeers() ?? []));
    }
    const peerId = upserted?.peer.id ?? (payload.from.port ? `${payload.from.name}::${payload.from.port}` : payload.from.name);
    const event: LanChatMessageEvent = {
      peerId,
      message: payload
    };
    this.mainWindow.webContents.send('lan:chatMessage', event);
    this.sendAckMessage(from.address, payload.from.port, {
      type: 'CHAT_ACK',
      payload: { messageId: payload.id, from: { name: this.deviceName, port: this.wsServer?.getPort() ?? 0 } }
    });
  }

  private async handleFileMessage(type: string, from: { address: string; port: number }, payload: any) {
    try {
      if (type === 'FILE_OFFER') {
        await this.handleFileOffer(from, payload);
      } else if (type === 'FILE_CHUNK') {
        await this.handleFileChunk(payload);
      } else if (type === 'FILE_COMPLETE') {
        this.handleFileComplete(payload);
      }
    } catch (error) {
      this.logger.error('File transfer handling failed.', error);
    }
  }

  private async handleFileOffer(from: { address: string; port: number }, payload: any) {
    const file = payload?.file as LanFileMeta | undefined;
    if (!file || !file.id || !file.name || !Number.isFinite(file.size)) {
      return;
    }
    const fromMeta = payload?.from as LanSignalMeta | undefined;
    const sourcePort = fromMeta?.port ?? from.port;
    const upserted = this.upsertPeerFromIncoming(fromMeta?.name, from.address, sourcePort);
    if (upserted?.added) {
      this.mainWindow.webContents.send('lan:peersUpdated', this.mergePeers(this.discovery?.listPeers() ?? []));
    }
    const peerId = upserted?.peer.id ?? `manual::${this.normalizeAddress(from.address)}:${sourcePort}`;

    const downloads = app.getPath('downloads');
    const targetPath = this.ensureUniqueFilePath(downloads, file.name);
    const stream = fs.createWriteStream(targetPath);
    this.incomingFiles.set(file.id, {
      stream,
      filePath: targetPath,
      size: file.size,
      received: 0,
      name: file.name,
      peerId,
      address: this.normalizeAddress(from.address),
      port: sourcePort
    });

    stream.on('error', (error) => {
      this.logger.error('Failed to write incoming file.', error);
      this.incomingFiles.delete(file.id);
    });
  }

  private async handleFileChunk(payload: any) {
    const fileId = payload?.fileId as string | undefined;
    if (!fileId) return;
    const entry = this.incomingFiles.get(fileId);
    if (!entry) return;
    const data = payload?.data as string | undefined;
    if (!data) return;
    const buffer = Buffer.from(data, 'base64');
    entry.received += buffer.length;
    await new Promise<void>((resolve, reject) => {
      entry.stream.write(buffer, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private handleFileComplete(payload: any) {
    const fileId = payload?.fileId as string | undefined;
    if (!fileId) return;
    const entry = this.incomingFiles.get(fileId);
    if (!entry) return;
    entry.stream.end();
    this.incomingFiles.delete(fileId);
    const event: LanFileReceivedEvent = {
      peerId: entry.peerId,
      name: entry.name,
      size: entry.size,
      filePath: entry.filePath
    };
    this.mainWindow.webContents.send('lan:fileReceived', event);
    this.sendAckMessage(entry.address, entry.port, {
      type: 'FILE_ACK',
      payload: { fileId, from: { name: this.deviceName, port: this.wsServer?.getPort() ?? 0 } }
    });
  }

  private handleAckMessage(type: 'CHAT_ACK' | 'FILE_ACK', from: { address: string; port: number }, payload: any) {
    const fromMeta = payload?.from as LanSignalMeta | undefined;
    const sourcePort = fromMeta?.port ?? from.port;
    const upserted = this.upsertPeerFromIncoming(fromMeta?.name, from.address, sourcePort);
    if (upserted?.added) {
      this.mainWindow.webContents.send('lan:peersUpdated', this.mergePeers(this.discovery?.listPeers() ?? []));
    }
    const peerId = upserted?.peer.id ?? `manual::${this.normalizeAddress(from.address)}:${sourcePort}`;

    if (type === 'CHAT_ACK') {
      const messageId = payload?.messageId as string | undefined;
      if (!messageId) return;
      const event: LanChatAckEvent = { peerId, messageId };
      this.mainWindow.webContents.send('lan:chatAck', event);
      return;
    }

    if (type === 'FILE_ACK') {
      const fileId = payload?.fileId as string | undefined;
      if (!fileId) return;
      const event: LanFileAckEvent = { peerId, fileId };
      this.mainWindow.webContents.send('lan:fileAck', event);
    }
  }

  private handleSignaling(type: string, from: { address: string; port: number }, payload: any) {
    // Find peer by address/port heuristic
    const normalizedAddress = this.normalizeAddress(from.address);
    const manualPeer = Array.from(this.manualPeers.values()).find(
      (peer) => this.normalizeAddress(peer.host) === normalizedAddress
    );
    const discoveredPeer = this.discovery?.listPeers().find(
      (peer) => this.normalizeAddress(peer.host) === normalizedAddress
    );
    let peer = manualPeer || discoveredPeer;

    console.log(`[LanPocManager] Received signaling ${type} from ${from.address}:${from.port}`);

    if (!peer) {
      const fromMeta = payload?.from;
      if (fromMeta && typeof fromMeta.port === 'number') {
        const upserted = this.upsertPeerFromIncoming(fromMeta.name, from.address, fromMeta.port);
        if (upserted?.peer) {
          peer = upserted.peer;
          if (upserted.added) {
            this.mainWindow.webContents.send('lan:peersUpdated', this.mergePeers(this.discovery?.listPeers() ?? []));
          }
        }
      }
    }

    if (peer) {
      this.mainWindow.webContents.send('lan:signaling', { peerId: peer.id, type, payload });
    } else {
      console.warn(`[LanPocManager] Unknown peer for signaling from ${from.address}`);
    }
  }

  private upsertPeerFromIncoming(name: string | undefined, host: string, port: number) {
    const normalizedHost = this.normalizeAddress(host);
    if (!normalizedHost || !Number.isFinite(port) || port <= 0) {
      return null;
    }
    const existingManual = Array.from(this.manualPeers.values()).find(
      (peer) => this.normalizeAddress(peer.host) === normalizedHost && peer.port === port
    );
    if (existingManual) {
      existingManual.lastSeen = new Date().toISOString();
      if (name && existingManual.name !== name) {
        existingManual.name = name;
      }
      return { peer: existingManual, added: false };
    }
    const existingDiscovered = this.discovery?.listPeers().find(
      (peer) => this.normalizeAddress(peer.host) === normalizedHost && peer.port === port
    );
    if (existingDiscovered) {
      existingDiscovered.lastSeen = new Date().toISOString();
      return { peer: existingDiscovered, added: false };
    }
    const peer: LanPeer = {
      id: `manual::${normalizedHost}:${port}`,
      name: name?.trim() || normalizedHost,
      host: normalizedHost,
      port,
      lastSeen: new Date().toISOString()
    };
    this.manualPeers.set(peer.id, peer);
    return { peer, added: true };
  }

  private normalizeAddress(address: string) {
    if (!address) return '';
    if (address.startsWith('::ffff:')) return address.slice(7);
    if (address === '::1') return '127.0.0.1';
    return address;
  }

  private async sendAckMessage(host: string, port: number, message: { type: 'CHAT_ACK' | 'FILE_ACK'; payload: any }) {
    if (!host || !Number.isFinite(port) || port <= 0) return;
    try {
      await this.wsClient.sendMessage(host, port, message as any);
    } catch (error) {
      this.logger.error('Failed to send ack message.', error);
    }
  }

  private ensureUniqueFilePath(directory: string, name: string) {
    const parsed = path.parse(name);
    let candidate = path.join(directory, name);
    let counter = 1;
    while (fs.existsSync(candidate)) {
      const nextName = `${parsed.name} (${counter})${parsed.ext}`;
      candidate = path.join(directory, nextName);
      counter += 1;
    }
    return candidate;
  }

  private guessMimeType(name: string) {
    const ext = path.extname(name).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ext === '.xls') return 'application/vnd.ms-excel';
    if (ext === '.csv') return 'text/csv';
    if (ext === '.doc') return 'application/msword';
    if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === '.ppt') return 'application/vnd.ms-powerpoint';
    if (ext === '.pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return 'application/octet-stream';
  }
}
