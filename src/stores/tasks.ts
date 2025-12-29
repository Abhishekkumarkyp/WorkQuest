import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import type { Task, Priority, Status } from '@shared/types';
import { useToastStore } from './toast';
import { useLogsStore } from './logs';

export interface TaskInput {
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  dueDate: string | null;
  tags: string[];
  estimateMinutes: number;
}

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: [] as Task[],
    loading: false
  }),
  getters: {
    topTasks: (state) => {
      const order: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };
      return [...state.tasks]
        .filter((task) => task.status !== 'Done')
        .sort((a, b) => order[b.priority] - order[a.priority])
        .slice(0, 3);
    },
    tasksByStatus: (state) => {
      return state.tasks.reduce((acc, task) => {
        acc[task.status] = acc[task.status] || [];
        acc[task.status].push(task);
        return acc;
      }, {} as Record<Status, Task[]>);
    }
  },
  actions: {
    normalizeTask(task: Task): Task {
      return {
        ...task,
        dueDate: task.dueDate ?? null,
        tags: Array.isArray(task.tags) ? [...task.tags] : []
      };
    },
    async load() {
      this.loading = true;
      try {
        this.tasks = await window.electronAPI.tasksList();
      } finally {
        this.loading = false;
      }
    },
    async createTask(input: TaskInput) {
      const toast = useToastStore();
      const now = new Date().toISOString();
      const task: Task = this.normalizeTask({
        id: uuidv4(),
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        dueDate: input.dueDate,
        tags: input.tags,
        estimateMinutes: input.estimateMinutes,
        createdAt: now,
        updatedAt: now
      });
      try {
        const saved = await window.electronAPI.tasksCreate(task);
        this.tasks.unshift(saved);
        toast.addToast('Task created.', 'success');
      } catch (error) {
        toast.addToast('Failed to create task.', 'error');
      }
    },
    async updateTask(task: Task) {
      const toast = useToastStore();
      const logs = useLogsStore();
      try {
        const updated: Task = this.normalizeTask({ ...task, updatedAt: new Date().toISOString() });
        const result = await window.electronAPI.tasksUpdate(updated);
        const index = this.tasks.findIndex((item) => item.id === updated.id);
        if (index >= 0) {
          this.tasks.splice(index, 1, result.task);
        }
        if (result.log) {
          logs.logs.unshift(result.log);
        }
        const completedMessage = result.log ? 'Task completed!' : 'Task updated.';
        toast.addToast(completedMessage, 'success');
      } catch (error) {
        toast.addToast('Failed to update task.', 'error');
      }
    },
    async deleteTask(id: string) {
      const toast = useToastStore();
      try {
        await window.electronAPI.tasksDelete(id);
        this.tasks = this.tasks.filter((task) => task.id !== id);
        toast.addToast('Task deleted.', 'success');
      } catch (error) {
        toast.addToast('Failed to delete task.', 'error');
      }
    },
    markDone(task: Task) {
      if (task.status === 'Done') return;
      const doneTask = this.normalizeTask({
        ...task,
        status: 'Done',
        updatedAt: dayjs().toISOString()
      });
      this.updateTask(doneTask);
    }
  }
});
