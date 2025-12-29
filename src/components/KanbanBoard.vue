<template>
  <div class="kanban-grid">
    <div v-for="status in statuses" :key="status" class="kanban-column">
      <div class="kanban-header">
        <h4>{{ status }}</h4>
        <span>{{ tasksByStatus[status]?.length || 0 }}</span>
      </div>
      <div class="kanban-cards">
        <div v-for="task in tasksByStatus[status] || []" :key="task.id" class="kanban-card">
          <h5>{{ task.title }}</h5>
          <p>{{ task.description || 'No description' }}</p>
          <div class="kanban-footer">
            <span v-if="task.dueDate">Due {{ formatDate(task.dueDate) }}</span>
            <div class="kanban-actions">
              <button @click="edit(task)">Edit</button>
              <button @click="markDone(task)">Done</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { STATUSES } from '@shared/constants';
import { useTasksStore } from '../stores/tasks';
import { useUiStore } from '../stores/ui';
import type { Task, Status } from '@shared/types';
import dayjs from 'dayjs';

export default {
  name: 'KanbanBoard',
  props: {
    tasksByStatus: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    statuses(): Status[] {
      return STATUSES;
    }
  },
  methods: {
    edit(task: Task) {
      useUiStore().openTaskModal(task);
    },
    markDone(task: Task) {
      useTasksStore().markDone(task);
    },
    formatDate(date: string) {
      return dayjs(date).format('MMM D');
    }
  }
};
</script>
