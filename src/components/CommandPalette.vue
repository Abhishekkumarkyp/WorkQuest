<template>
  <div v-if="show" class="command-overlay" @click.self="close">
    <div class="command-modal">
      <input
        ref="searchInput"
        v-model="query"
        class="command-input"
        placeholder="Type a command..."
      />
      <div class="command-list">
        <button
          v-for="command in filteredCommands"
          :key="command.id"
          class="command-item"
          @click="execute(command)"
        >
          <span>{{ command.title }}</span>
          <small>{{ command.hint }}</small>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { useUiStore } from '../stores/ui';

export default {
  name: 'CommandPalette',
  data() {
    return {
      query: '' as string
    };
  },
  computed: {
    show() {
      const ui = useUiStore();
      return ui.showCommandPalette;
    },
    commands() {
      const ui = useUiStore();
      return [
        {
          id: 'new-task',
          title: 'New Task',
          hint: 'Create a fresh task',
          action: () => ui.openTaskModal()
        },
        {
          id: 'export-tasks',
          title: 'Export Tasks',
          hint: 'Save tasks to Excel',
          action: async () => {
            await window.electronAPI.excelExportTasks();
          }
        },
        {
          id: 'go-dashboard',
          title: 'Go to Dashboard',
          hint: 'Today overview',
          action: () => this.$router.push('/')
        },
        {
          id: 'go-tasks',
          title: 'Go to Tasks',
          hint: 'Task board',
          action: () => this.$router.push('/tasks')
        },
        {
          id: 'go-share',
          title: 'Go to Share Center',
          hint: 'Share my day',
          action: () => this.$router.push('/share')
        }
      ];
    },
    filteredCommands() {
      const query = this.query.toLowerCase();
      return this.commands.filter((command) => command.title.toLowerCase().includes(query));
    }
  },
  watch: {
    show(value: boolean) {
      if (value) {
        this.query = '';
        this.$nextTick(() => {
          (this.$refs.searchInput as HTMLInputElement)?.focus();
        });
      }
    }
  },
  methods: {
    close() {
      const ui = useUiStore();
      ui.closeCommandPalette();
    },
    execute(command: { action: () => void }) {
      command.action();
      this.close();
    }
  }
};
</script>
