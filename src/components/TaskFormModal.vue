<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal">
      <h3>{{ editingTask ? 'Edit Task' : 'New Task' }}</h3>
      <div class="form-grid">
        <AppInput v-model="form.title" label="Title" placeholder="Add a crisp task title" />
        <AppSelect v-model="form.priority" label="Priority" :options="priorities" />
        <AppSelect v-model="form.status" label="Status" :options="statuses" />
        <AppInput v-model="form.dueDate" label="Due Date" type="date" />
        <AppInput v-model="form.estimateMinutes" label="Estimate (min)" type="number" min="0" />
      </div>
      <AppInput v-model="form.description" label="Description" placeholder="Optional details" />
      <AppInput v-model="form.tagsText" label="Tags" placeholder="Comma separated" />

      <div class="modal-actions">
        <AppButton variant="ghost" @click="close">Cancel</AppButton>
        <AppButton @click="save">Save</AppButton>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import AppButton from './AppButton.vue';
import AppInput from './AppInput.vue';
import AppSelect from './AppSelect.vue';
import { PRIORITIES, STATUSES } from '@shared/constants';
import { useUiStore } from '../stores/ui';
import { useTasksStore } from '../stores/tasks';
import type { Task } from '@shared/types';

export default {
  name: 'TaskFormModal',
  components: { AppButton, AppInput, AppSelect },
  data() {
    return {
      form: {
        title: '',
        description: '',
        priority: 'Medium',
        status: 'Todo',
        dueDate: '',
        estimateMinutes: 30,
        tagsText: ''
      }
    };
  },
  computed: {
    priorities() {
      return PRIORITIES;
    },
    statuses() {
      return STATUSES;
    },
    show() {
      return useUiStore().showTaskModal;
    },
    editingTask(): Task | null {
      return useUiStore().editingTask;
    }
  },
  watch: {
    editingTask: {
      immediate: true,
      handler(task: Task | null) {
        if (task) {
          this.form = {
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
            estimateMinutes: task.estimateMinutes,
            tagsText: task.tags.join(', ')
          };
        } else {
          this.reset();
        }
      }
    }
  },
  methods: {
    close() {
      useUiStore().closeTaskModal();
    },
    reset() {
      this.form = {
        title: '',
        description: '',
        priority: 'Medium',
        status: 'Todo',
        dueDate: '',
        estimateMinutes: 30,
        tagsText: ''
      };
    },
    async save() {
      const tasks = useTasksStore();
      const payload = {
        title: this.form.title.trim(),
        description: this.form.description.trim(),
        priority: this.form.priority,
        status: this.form.status,
        dueDate: this.form.dueDate ? new Date(this.form.dueDate).toISOString() : null,
        estimateMinutes: Number(this.form.estimateMinutes) || 0,
        tags: this.form.tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      };

      if (!payload.title) return;

      if (this.editingTask) {
        await tasks.updateTask({
          ...this.editingTask,
          ...payload
        });
      } else {
        await tasks.createTask(payload);
      }
      this.close();
    }
  }
};
</script>
