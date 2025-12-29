<template>
  <div class="task-list">
    <div v-for="task in tasks" :key="task.id" class="task-row">
      <div>
        <h4>{{ task.title }}</h4>
        <p class="task-meta">
          <AppBadge :tone="priorityTone(task.priority)">{{ task.priority }}</AppBadge>
          <span>{{ task.status }}</span>
          <span v-if="task.dueDate">Due {{ formatDate(task.dueDate) }}</span>
        </p>
        <div class="task-tags">
          <span v-for="tag in task.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
      <div class="task-actions">
        <AppButton compact variant="ghost" @click="edit(task)">Edit</AppButton>
        <AppButton compact variant="ghost" @click="markDone(task)">Done</AppButton>
        <AppButton compact variant="ghost" @click="remove(task)">Delete</AppButton>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import AppBadge from './AppBadge.vue';
import AppButton from './AppButton.vue';
import { useUiStore } from '../stores/ui';
import { useTasksStore } from '../stores/tasks';
import type { Task, Priority } from '@shared/types';
import dayjs from 'dayjs';

export default {
  name: 'TaskList',
  components: { AppBadge, AppButton },
  props: {
    tasks: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    edit(task: Task) {
      useUiStore().openTaskModal(task);
    },
    markDone(task: Task) {
      useTasksStore().markDone(task);
    },
    remove(task: Task) {
      useTasksStore().deleteTask(task.id);
    },
    formatDate(date: string) {
      return dayjs(date).format('MMM D');
    },
    priorityTone(priority: Priority) {
      if (priority === 'High') return 'danger';
      if (priority === 'Medium') return 'warning';
      return 'success';
    }
  }
};
</script>
