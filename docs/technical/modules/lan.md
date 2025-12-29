# LAN Module Documentation

The LAN module provides decentralized, peer-to-peer communication capabilities including discovery, text chat, and voice calling.

## Features
-   **Zero-Config Discovery**: Automatically finds other peers on the local subnet.
-   **Ephemeral Messaging**: Sends text messages without persistent connections.
-   **Voice Calling**: High-quality P2P audio via WebRTC.

## Components

### Renderer (`src/stores/lan.ts`)
Manages the state of peers, chat history, and active calls.
-   `peers`: List of discovered LAN devices.
-   `chatMessages`: History of sent/received messages.
-   `activeCall`: State object for the current WebRTC session.

### Main Process (`electron/lan/`)
-   **`lanPocManager.ts`**: Orchestrator. Starts/stops services and routes events.
-   **`discovery.ts`**: Wraps `bonjour-service` for mDNS publishing and browsing.
-   **`wsServer.ts`**: Listens for incoming connections on a random TCP port.
-   **`wsClient.ts`**: Creates short-lived connections to peers for sending data.

## Protocol

### Discovery
Service Type: `_my-lan-app._tcp`
Peers broadcast their presence. The main process aggregates mDNS service up/down events to maintain a live peer list.

### WebSocket Messages
All communication happens via JSON payloads over TCP.

1.  **Handshake** (`HELLO`)
    Initiated immediately upon connection. Contains device name and protocol version.
2.  **Chat** (`CHAT_MESSAGE`)
    Contains text payload and sender metadata.
3.  **Signaling** (WebRTC)
    -   `CALL_OFFER`: SDP Offer.
    -   `CALL_ANSWER`: SDP Answer.
    -   `ICE_CANDIDATE`: Network path candidates.
    -   `CALL_END`: Termination signal.

## Voice Calling Flow
1.  **Initiation**: User A clicks Call. `LanStore` creates `RTCPeerConnection` and sends `CALL_OFFER` via Main Process.
2.  **Signaling**: Main Process B receives Offer, alerts User B. User B answers, sending `CALL_ANSWER`.
3.  **Connectivity**: Both sides exchange `ICE_CANDIDATE`s until a direct path is found.
4.  **Media**: Audio flows directly between Renderer A and Renderer B (P2P).
