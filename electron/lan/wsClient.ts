import fs from 'fs';
import { WebSocket } from 'ws';
import type {
  ChatMessagePayload,
  LanFileMeta,
  LanMessage,
  LanPeer,
  LanSignalMeta,
  TodaySummaryPayload
} from '@shared/lan-protocol';

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

const waitForMessage = <T extends LanMessage>(
  socket: WebSocket,
  predicate: (message: LanMessage) => message is T,
  timeoutMs: number
) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('LAN request timed out.'));
    }, timeoutMs);

    const handleMessage = (data: WebSocket.RawData) => {
      const message = parseMessage(data);
      if (!message) return;
      if (!predicate(message)) return;
      cleanup();
      resolve(message);
    };

    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('message', handleMessage);
      socket.off('error', handleError);
    };

    socket.on('message', handleMessage);
    socket.on('error', handleError);
  });

const connectSocket = (peer: LanPeer, timeoutMs: number) =>
  new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(`ws://${peer.host}:${peer.port}`, {
      handshakeTimeout: timeoutMs
    });
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error('LAN connection timed out.'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('open', handleOpen);
      socket.off('error', handleError);
    };

    const handleOpen = () => {
      cleanup();
      resolve(socket);
    };

    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    socket.on('open', handleOpen);
    socket.on('error', handleError);
  });

export class LanWsClient {
  constructor(private helloPayload: LanMessage & { type: 'HELLO' }) { }

  async ping(peer: LanPeer, timeoutMs: number) {
    const socket = await connectSocket(peer, timeoutMs);
    try {
      sendMessage(socket, this.helloPayload);
      await waitForMessage(socket, (message): message is LanMessage & { type: 'HELLO_OK' } => {
        return message.type === 'HELLO_OK';
      }, timeoutMs);
      sendMessage(socket, { type: 'PING' });
      await waitForMessage(socket, (message): message is LanMessage & { type: 'PONG' } => {
        return message.type === 'PONG';
      }, timeoutMs);
    } finally {
      socket.close();
    }
  }

  async requestSummary(peer: LanPeer, requestId: string, timeoutMs: number): Promise<TodaySummaryPayload> {
    const socket = await connectSocket(peer, timeoutMs);
    try {
      sendMessage(socket, this.helloPayload);
      await waitForMessage(socket, (message): message is LanMessage & { type: 'HELLO_OK' } => {
        return message.type === 'HELLO_OK';
      }, timeoutMs);
      sendMessage(socket, { type: 'REQUEST_TODAY_SUMMARY', requestId });
      const response = await waitForMessage(
        socket,
        (message): message is LanMessage & { type: 'TODAY_SUMMARY' } =>
          message.type === 'TODAY_SUMMARY' && message.requestId === requestId,
        timeoutMs
      );
      return response.payload;
    } finally {
      socket.close();
    }
  }

  async sendChat(peer: LanPeer, payload: ChatMessagePayload, timeoutMs: number) {
    const socket = await connectSocket(peer, timeoutMs);
    try {
      sendMessage(socket, this.helloPayload);
      await waitForMessage(socket, (message): message is LanMessage & { type: 'HELLO_OK' } => {
        return message.type === 'HELLO_OK';
      }, timeoutMs);
      sendMessage(socket, { type: 'CHAT_MESSAGE', payload });
    } finally {
      socket.close();
    }
  }

  async sendMessage(host: string, port: number, message: LanMessage, timeoutMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${host}:${port}`);

      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timed out'));
      }, timeoutMs);

      ws.on('open', () => {
        ws.send(JSON.stringify(this.helloPayload));
      });

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString()) as LanMessage;
          if (response.type === 'HELLO_OK') {
            ws.send(JSON.stringify(message));
            setTimeout(() => {
              ws.close();
              clearTimeout(timer);
              resolve();
            }, 100);
          }
        } catch (err) {
          // ignore
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async sendFile(
    peer: LanPeer,
    file: LanFileMeta,
    filePath: string,
    from: LanSignalMeta,
    chunkSize: number,
    timeoutMs: number
  ) {
    const socket = await connectSocket(peer, timeoutMs);
    try {
      sendMessage(socket, this.helloPayload);
      await waitForMessage(socket, (message): message is LanMessage & { type: 'HELLO_OK' } => {
        return message.type === 'HELLO_OK';
      }, timeoutMs);

      sendMessage(socket, { type: 'FILE_OFFER', payload: { file, from } });

      const total = Math.max(1, Math.ceil(file.size / chunkSize));
      let index = 0;
      const stream = fs.createReadStream(filePath, { highWaterMark: chunkSize });
      for await (const chunk of stream) {
        const data = Buffer.isBuffer(chunk) ? chunk.toString('base64') : Buffer.from(chunk as any).toString('base64');
        sendMessage(socket, {
          type: 'FILE_CHUNK',
          payload: {
            fileId: file.id,
            index,
            total,
            data,
            from
          }
        });
        index += 1;
      }

      sendMessage(socket, { type: 'FILE_COMPLETE', payload: { fileId: file.id, from } });
    } finally {
      socket.close();
    }
  }
}
