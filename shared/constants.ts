import type { Priority, Status, Settings } from './types';

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];
export const STATUSES: Status[] = ['Todo', 'InProgress', 'Blocked', 'Done'];

export const DEFAULT_SETTINGS: Settings = {
  theme: 'glass',
  notificationsEnabled: true,
  privacyLeaderboard: true
};

export const APP_NAME = 'WorkQuest';
