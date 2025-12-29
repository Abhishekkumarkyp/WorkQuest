import { defineStore } from 'pinia';
import type { WorkLog } from '@shared/types';
import { useToastStore } from './toast';

export const useLogsStore = defineStore('logs', {
  state: () => ({
    logs: [] as WorkLog[],
    loading: false
  }),
  actions: {
    async load() {
      this.loading = true;
      try {
        this.logs = await window.electronAPI.logsList();
      } finally {
        this.loading = false;
      }
    },
    async addLog(log: WorkLog) {
      const toast = useToastStore();
      try {
        const saved = await window.electronAPI.logsAdd(log);
        this.logs.unshift(saved);
      } catch (error) {
        toast.addToast('Failed to add log entry.', 'error');
      }
    }
  }
});
