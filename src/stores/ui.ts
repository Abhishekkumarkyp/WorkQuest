import { defineStore } from 'pinia';
import type { Task } from '@shared/types';

export const useUiStore = defineStore('ui', {
  state: () => ({
    showCommandPalette: false,
    showTaskModal: false,
    editingTask: null as Task | null
  }),
  actions: {
    openCommandPalette() {
      this.showCommandPalette = true;
    },
    closeCommandPalette() {
      this.showCommandPalette = false;
    },
    openTaskModal(task?: Task) {
      this.editingTask = task ?? null;
      this.showTaskModal = true;
    },
    closeTaskModal() {
      this.showTaskModal = false;
      this.editingTask = null;
    }
  }
});
