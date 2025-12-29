# WorkQuest

Fun office To-Do + Daily Activity Tracker built with Electron, Vite, and Vue 3.

## Highlights
- Electron + Vite + Vue 3 (Options API)
- Pinia state management
- Offline storage via SQLite (better-sqlite3) with auto fallback to electron-store JSON
- Excel import/export powered by ExcelJS
- Tray support, keyboard shortcuts, notifications, and Share My Day

## Setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Windows EXE

```bash
npm run dist
```

If you see a symlink privilege error while building on Windows, either enable
Windows Developer Mode or keep using the provided `npm run dist` script (it
sets `ELECTRON_BUILDER_DISABLE_SEVEN_ZIP_SYMLINKS` and `ELECTRON_BUILDER_DISABLE_SYMLINKS`).

## Keyboard Shortcuts
- `Ctrl + K` Command palette
- `Ctrl + N` New task
- `Ctrl + Shift + E` Export tasks

## Storage Fallback
If `better-sqlite3` fails to build, WorkQuest automatically switches to `electron-store`.
The repository interface remains identical, and Excel import/export continues to work.

### SQLite Build Notes (Windows)
`better-sqlite3` is an optional dependency. If you want SQLite, install the
"Desktop development with C++" workload in Visual Studio Build Tools and rerun `npm install`.
Node 20 LTS also has broader prebuilt support for native modules.

## Architecture
- `electron/` Electron main + preload + IPC handlers
- `src/` Vue 3 renderer
- `shared/` Shared types/constants
- `db/` Repository + migrations

## Notes
- Logs are written to the user data directory under `logs/app.log`.
- Seed data is created on the first run.

## LAN Share POC (Today Summary)

### How to test with two laptops on same Wi-Fi
1. On both devices, run `npm install` and `npm run dev`.
2. Open the "LAN Share" page and click "Start LAN".
3. Click "Refresh Peers" to discover the other device.
4. Use "Ping" to verify connectivity.
5. Click "Get Summary" to fetch the peer Today Summary.

Firewall note: the first time the app listens on a port, the OS firewall may prompt.
Allow incoming connections on the local network so peers can connect.
