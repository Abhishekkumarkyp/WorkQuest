import { defineStore } from 'pinia';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const useToastStore = defineStore('toast', {
  state: () => ({
    toasts: [] as Toast[]
  }),
  actions: {
    addToast(message: string, type: Toast['type'] = 'info') {
      const toast: Toast = { id: `${Date.now()}-${Math.random()}`, message, type };
      this.toasts.push(toast);
      setTimeout(() => this.removeToast(toast.id), 3200);
    },
    removeToast(id: string) {
      this.toasts = this.toasts.filter((toast) => toast.id !== id);
    }
  }
});
