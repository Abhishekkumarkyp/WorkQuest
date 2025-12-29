import { defineStore } from 'pinia';
import type { Settings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { useToastStore } from './toast';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: { ...DEFAULT_SETTINGS } as Settings,
    loading: false
  }),
  actions: {
    async load() {
      this.loading = true;
      try {
        this.settings = await window.electronAPI.settingsGet();
        this.applyTheme();
      } finally {
        this.loading = false;
      }
    },
    async update(partial: Partial<Settings>) {
      const toast = useToastStore();
      try {
        this.settings = await window.electronAPI.settingsSet(partial);
        this.applyTheme();
        toast.addToast('Settings updated.', 'success');
      } catch (error) {
        toast.addToast('Failed to update settings.', 'error');
      }
    },
    applyTheme() {
      document.documentElement.dataset.theme = this.settings.theme;
    }
  }
});
