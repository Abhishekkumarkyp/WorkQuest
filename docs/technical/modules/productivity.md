# Productivity Module Documentation

This module encompasses the core "Get Things Done" features of the application: Task management, time tracking, and focus sessions.

## 1. Task Management
**File**: `src/stores/tasks.ts`

### Data Model
-   `Task`: The core unit of work.
    -   `id`: UUID.
    -   `title`, `description`.
    -   `priority`: High, Medium, Low.
    -   `status`: Todo, In Progress, Done.
    -   `tags`: String array for categorization.

### Logic
-   **CRUD**: Create, Read, Update, Delete operations are effectively proxied to the Main process via `window.electronAPI.tasks*`.
-   **Normalization**: Ensures data integrity (e.g., stripping null dates).
-   **Getters**: `topTasks` sorts by priority for the Dashboard; `tasksByStatus` groups for the Kanban view.

## 2. Work Logs
**File**: `src/stores/logs.ts`

### Data Model
-   `WorkLog`: A record of completed activity.
    -   `taskId`: Reference to a Task (optional).
    -   `timeSpentMinutes`: Duration.
    -   `outcome`: User-entered notes.

### Logic
-   Logs are typically created automatically when a Task is marked 'Done' or a Focus Session is completed.
-   The store maintains a historical list (`logs`) for the Work Log page.

## 3. Focus Mode
**File**: `src/stores/focus.ts`

### Functionality
Implements a Pomodoro-style timer.

### State
-   `durationMinutes`: Default 25.
-   `remainingSeconds`: Countdown value.
-   `isRunning`: Boilerplate active state.

### Integration
-   **Toast**: Notifies user upon completion.
-   **Logs**: Automatically generates a `WorkLog` entry of type `focus` when a session finishes successfully.
