import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import type { ChatMessagePayload, HelloPayload, LanMessage, TodaySummaryPayload } from '@shared/lan-protocol';

const parseMessage = (data: WebSocket.RawData): LanMessage | null => {
  try {
    const text = data.toString();
    const parsed = JSON.parse(text) as LanMessage;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const sendMessage = (socket: WebSocket, message: LanMessage) => {
  socket.send(JSON.stringify(message));
};

const normalizeAddress = (address: string) => {
  if (!address) return '';
  if (address.startsWith('::ffff:')) return address.slice(7);
  if (address === '::1') return '127.0.0.1';
  return address;
};

export class LanWsServer {
  private server: WebSocketServer | null = null;
  private port: number | null = null;

  constructor(
    private helloPayload: HelloPayload,
    private getSummary: () => Promise<TodaySummaryPayload>,
    private onChatMessage: (payload: ChatMessagePayload, from: { address: string }) => void,
    private onFileMessage: (type: string, from: { address: string; port: number }, payload: any) => void,
    private onAckMessage: (type: 'CHAT_ACK' | 'FILE_ACK', from: { address: string; port: number }, payload: any) => void,
    private onSignaling: (type: string, from: { address: string; port: number }, payload: any) => void,
    private onError: (message: string, error?: unknown) => void
  ) { }

  async start() {
    if (this.server) {
      return this.port ?? 0;
    }
    this.server = new WebSocketServer({ port: 0 });
    this.server.on('connection', (socket) => this.handleConnection(socket));
    await new Promise<void>((resolve) => {
      this.server?.once('listening', () => resolve());
    });
    const address = this.server.address();
    if (typeof address === 'object' && address) {
      this.port = address.port;
    }
    return this.port ?? 0;
  }

  stop() {
    if (!this.server) return;
    this.server.close();
    this.server = null;
    this.port = null;
  }

  getPort() {
    return this.port ?? 0;
  }

  private handleConnection(socket: WebSocket) {
    socket.on('message', async (data) => {
      const message = parseMessage(data);
      if (!message) return;
      try {
        if (message.type === 'HELLO') {
          sendMessage(socket, { type: 'HELLO_OK', payload: this.helloPayload });
          return;
        }
        if (message.type === 'PING') {
          sendMessage(socket, { type: 'PONG' });
          return;
        }
        if (message.type === 'REQUEST_TODAY_SUMMARY') {
          const summary = await this.getSummary();
          sendMessage(socket, {
            type: 'TODAY_SUMMARY',
            requestId: message.requestId,
            payload: summary
          });
        }
        if (message.type === 'CHAT_MESSAGE') {
          const rawAddress = (socket as any)._socket?.remoteAddress || '';
          const address = normalizeAddress(rawAddress);
          this.onChatMessage(message.payload, { address });
        }
        if (['FILE_OFFER', 'FILE_CHUNK', 'FILE_COMPLETE'].includes(message.type)) {
          const rawAddress = (socket as any)._socket?.remoteAddress || '';
          const address = normalizeAddress(rawAddress);
          const port = (socket as any)._socket?.remotePort ?? 0;
          this.onFileMessage(message.type, { address, port }, (message as any).payload);
        }
        if (['CHAT_ACK', 'FILE_ACK'].includes(message.type)) {
          const rawAddress = (socket as any)._socket?.remoteAddress || '';
          const address = normalizeAddress(rawAddress);
          const port = (socket as any)._socket?.remotePort ?? 0;
          this.onAckMessage(message.type as 'CHAT_ACK' | 'FILE_ACK', { address, port }, (message as any).payload);
        }
        if (['CALL_OFFER', 'CALL_ANSWER', 'ICE_CANDIDATE', 'CALL_END'].includes(message.type)) {
          const rawAddress = (socket as any)._socket?.remoteAddress || '';
          const address = normalizeAddress(rawAddress);
          const port = (socket as any)._socket?.remotePort ?? 0;
          this.onSignaling(message.type, { address, port }, (message as any).payload);
        }
      } catch (error) {
        this.onError('LAN server message failed.', error);
      }
    });
  }
}
