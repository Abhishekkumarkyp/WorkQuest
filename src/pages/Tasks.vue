<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>Tasks</h2>
        <p>Manage your day with clarity and momentum.</p>
      </div>
      <div class="header-actions">
        <AppButton variant="ghost" @click="toggleView">
          {{ viewMode === 'list' ? 'Kanban View' : 'List View' }}
        </AppButton>
        <AppButton @click="openTaskModal">New Task</AppButton>
      </div>
    </div>

    <AppCard>
      <TaskList v-if="viewMode === 'list'" :tasks="tasks" />
      <KanbanBoard v-else :tasks-by-status="tasksByStatus" />
      <EmptyState
        v-if="tasks.length === 0"
        title="No tasks yet"
        subtitle="Create your first WorkQuest task."
      />
    </AppCard>
  </div>
</template>

<script lang="ts">
import AppButton from '../components/AppButton.vue';
import AppCard from '../components/AppCard.vue';
import EmptyState from '../components/EmptyState.vue';
import TaskList from '../components/TaskList.vue';
import KanbanBoard from '../components/KanbanBoard.vue';
import { useTasksStore } from '../stores/tasks';
import { useUiStore } from '../stores/ui';

export default {
  name: 'Tasks',
  components: { AppButton, AppCard, EmptyState, TaskList, KanbanBoard },
  data() {
    return {
      viewMode: 'list'
    };
  },
  computed: {
    tasks() {
      return useTasksStore().tasks;
    },
    tasksByStatus() {
      return useTasksStore().tasksByStatus;
    }
  },
  methods: {
    toggleView() {
      this.viewMode = this.viewMode === 'list' ? 'kanban' : 'list';
    },
    openTaskModal() {
      useUiStore().openTaskModal();
    }
  }
};
</script>
