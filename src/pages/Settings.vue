<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>Settings</h2>
        <p>Personalize your WorkQuest experience.</p>
      </div>
    </div>

    <div class="settings-grid">
      <AppCard>
        <h3>Appearance</h3>
        <div class="setting-row">
          <span>Theme</span>
          <select v-model="theme">
            <option value="glass">Dynamic Glass</option>
            <option value="light">Crystal Light</option>
          </select>
        </div>
      </AppCard>

      <AppCard>
        <h3>Notifications</h3>
        <div class="setting-row">
          <span>Desktop Reminders</span>
          <label class="toggle">
            <input type="checkbox" v-model="notificationsEnabled" />
            <span></span>
          </label>
        </div>
      </AppCard>

      <AppCard>
        <h3>Privacy</h3>
        <div class="setting-row">
          <span>Leaderboard Visibility</span>
          <label class="toggle">
            <input type="checkbox" v-model="privacyLeaderboard" />
            <span></span>
          </label>
        </div>
      </AppCard>
    </div>
  </div>
</template>

<script lang="ts">
import AppCard from '../components/AppCard.vue';
import { useSettingsStore } from '../stores/settings';

export default {
  name: 'Settings',
  components: { AppCard },
  computed: {
    theme: {
      get() {
        return useSettingsStore().settings.theme;
      },
      set(value: string) {
        useSettingsStore().update({ theme: value as 'glass' | 'light' });
      }
    },
    notificationsEnabled: {
      get() {
        return useSettingsStore().settings.notificationsEnabled;
      },
      set(value: boolean) {
        useSettingsStore().update({ notificationsEnabled: value });
      }
    },
    privacyLeaderboard: {
      get() {
        return useSettingsStore().settings.privacyLeaderboard;
      },
      set(value: boolean) {
        useSettingsStore().update({ privacyLeaderboard: value });
      }
    }
  }
};
</script>
