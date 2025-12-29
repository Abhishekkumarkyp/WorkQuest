import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import type { WorkLog } from '@shared/types';
import { useLogsStore } from './logs';
import { useToastStore } from './toast';

export const useFocusStore = defineStore('focus', {
  state: () => ({
    durationMinutes: 25,
    remainingSeconds: 25 * 60,
    isRunning: false,
    timerId: null as number | null
  }),
  getters: {
    displayTime: (state) => {
      const minutes = Math.floor(state.remainingSeconds / 60);
      const seconds = state.remainingSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  },
  actions: {
    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.timerId = window.setInterval(() => this.tick(), 1000);
    },
    pause() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      this.isRunning = false;
    },
    reset() {
      this.pause();
      this.remainingSeconds = this.durationMinutes * 60;
    },
    tick() {
      if (!this.isRunning) return;
      this.remainingSeconds -= 1;
      if (this.remainingSeconds <= 0) {
        this.complete();
      }
    },
    async complete() {
      this.pause();
      this.remainingSeconds = this.durationMinutes * 60;
      const logsStore = useLogsStore();
      const toast = useToastStore();
      const log: WorkLog = {
        id: uuidv4(),
        date: dayjs().format('YYYY-MM-DD'),
        taskId: null,
        titleSnapshot: 'Focus Session',
        timeSpentMinutes: this.durationMinutes,
        outcome: 'Session complete.',
        type: 'focus',
        createdAt: new Date().toISOString()
      };
      await logsStore.addLog(log);
      toast.addToast('Focus session completed. +1 point!', 'success');
    }
  }
});
