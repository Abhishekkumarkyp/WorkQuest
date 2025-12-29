# Utilities Module Documentation

This module covers helper features that support the core application workflow.

## 1. Excel Center
**Files**: `src/pages/ExcelCenter.vue`, `electron/main.ts` (handlers)

### Functionality
-   **Import**: Parses `.xlsx` files to bulk-create tasks.
-   **Export**: Generates `.xlsx` reports for:
    -   All Tasks
    -   Daily Work Logs

### Dependencies
-   `xlsx`: Used in the Main process to read/write spreadsheet files.

## 2. Share Center
**Files**: `src/pages/ShareCenter.vue`

### Functionality
-   **Text Sharing**: Provides a quick way to copy text across the LAN (conceptually, currently local clipboard helper).
-   **Image Saving**: Accepts base64 image data and saves it to the local disk.

## 3. Settings
**Files**: `src/stores/settings.ts`

### Functionality
Manages global application preferences.
-   **Persistence**: Settings are saved to `config.json` via `electron-store`.
-   **Properties**:
    -   Theme (Dark/Light).
    -   Notifications enabled/disabled.
    -   User name/Device name overrides.
