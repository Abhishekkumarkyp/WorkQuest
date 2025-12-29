<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-mark">WQ</div>
        <div>
          <h3>WorkQuest</h3>
          <p>Office Adventure</p>
        </div>
      </div>
      <nav class="nav">
        <RouterLink to="/" class="nav-link">Dashboard</RouterLink>
        <RouterLink to="/tasks" class="nav-link">Tasks</RouterLink>
        <RouterLink to="/work-log" class="nav-link">Work Log</RouterLink>
        <RouterLink to="/excel" class="nav-link">Excel Center</RouterLink>
        <RouterLink to="/share" class="nav-link">Share Center</RouterLink>
        <RouterLink to="/lan-connect" class="nav-link">LAN Connect</RouterLink>
        <RouterLink to="/lan-chat" class="nav-link">LAN Chat</RouterLink>
        <RouterLink to="/settings" class="nav-link">Settings</RouterLink>
      </nav>
      <div class="sidebar-footer">
        <div class="glass-pill">Ctrl + K for commands</div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="topbar-left">
          <h2>WorkQuest</h2>
          <span class="status-pill">AI Glow Mode</span>
        </div>
        <div class="topbar-center">
          <div class="metric">
            <strong>{{ points }}</strong>
            <span>Points</span>
          </div>
          <div class="metric">
            <strong>{{ streak }}</strong>
            <span>Streak</span>
          </div>
        </div>
        <div class="topbar-actions">
          <AppButton variant="ghost" @click="openCommandPalette">Command</AppButton>
          <AppButton @click="openTaskModal">New Task</AppButton>
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>

    <CommandPalette />
    <TaskFormModal />
    <ToastList />
  </div>
</template>

<script lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import AppButton from './components/AppButton.vue';
import CommandPalette from './components/CommandPalette.vue';
import TaskFormModal from './components/TaskFormModal.vue';
import ToastList from './components/ToastList.vue';
import { useTasksStore } from './stores/tasks';
import { useLogsStore } from './stores/logs';
import { useSettingsStore } from './stores/settings';
import { useUiStore } from './stores/ui';
import { useStatsStore } from './stores/stats';
import { useToastStore } from './stores/toast';
import { useLanStore } from './stores/lan';

export default {
  name: 'App',
  components: { RouterLink, RouterView, AppButton, CommandPalette, TaskFormModal, ToastList },
  data() {
    return {
      trayCleanup: null as null | (() => void)
    };
  },
  computed: {
    points() {
      return useStatsStore().points;
    },
    streak() {
      return useStatsStore().streak;
    }
  },
  async mounted() {
    await Promise.all([
      useTasksStore().load(),
      useLogsStore().load(),
      useSettingsStore().load(),
      useLanStore().init()
    ]);
    this.trayCleanup = window.electronAPI.onTrayAddTask(() => {
      useUiStore().openTaskModal();
    });
    window.addEventListener('keydown', this.handleKeydown);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeydown);
    if (this.trayCleanup) this.trayCleanup();
  },
  methods: {
    openTaskModal() {
      useUiStore().openTaskModal();
    },
    openCommandPalette() {
      useUiStore().openCommandPalette();
    },
    async handleKeydown(event: KeyboardEvent) {
      const toast = useToastStore();
      if (event.ctrlKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        useUiStore().openCommandPalette();
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        useUiStore().openTaskModal();
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        const result = await window.electronAPI.excelExportTasks();
        if (result.filePath) {
          toast.addToast(`Exported to ${result.filePath}`, 'success');
        }
      }
    }
  }
};
</script>
