# API Reference

This document details the interface exposed to the Renderer process via the `window.electronAPI` bridge.

## Type Definition
The complete TypeScript interface is defined in [`src/types/electron-api.ts`](file:///d:/Projects/electron/src/types/electron-api.ts).

## core
### `tasksList()`
-   **Returns**: `Promise<Task[]>`
-   **Description**: Returns all persisted tasks.

### `tasksCreate(task: Task)`
-   **Arguments**: `task` (Task object without ID)
-   **Returns**: `Promise<Task>`
-   **Description**: Persists a new task and returns the record with generated ID.

### `tasksUpdate(task: Task)`
-   **Arguments**: `task` (Updated Task object)
-   **Returns**: `Promise<{ task: Task; log?: WorkLog | null }>`
-   **Description**: Updates a task. If status changes to 'Done', it may optionally return a generated WorkLog.

## lan
### `lan.start()`
-   **Returns**: `Promise<LanStartResult>`
-   **Description**: Starts the WebSocket server and UDP discovery service.

### `lan.sendChat(peerId, text)`
-   **Arguments**: 
    -   `peerId`: Target peer identifier.
    -   `text`: Message content.
-   **Returns**: `Promise<ChatMessagePayload>`
-   **Description**: Sends a text message to the specified peer.

### `lan.sendSignaling(peerId, type, payload)`
-   **Arguments**:
    -   `peerId`: Target peer.
    -   `type`: 'CALL_OFFER' | 'CALL_ANSWER' | 'ICE_CANDIDATE' | 'CALL_END'.
    -   `payload`: WebRTC SDP or ICE candidate object.
-   **Description**: Forwards a WebRTC signaling message to a peer to establish a voice call.

### `lan.onPeersUpdated(callback)`
-   **Callback**: `(peers: LanPeer[]) => void`
-   **Description**: Subscribes to changes in the discovered peer list.

### `lan.onSignaling(callback)`
-   **Callback**: `(event: { peerId, type, payload }) => void`
-   **Description**: Subscribes to incoming WebRTC signaling messages.

## events
### `showNotification(options)`
-   **Arguments**: `{ title: string; body: string; payload?: any }`
-   **Description**: Triggers a native system notification.

### `onNotificationClick(callback)`
-   **Callback**: `(payload: any) => void`
-   **Description**: Subscribes to click events on notifications.
