<template>
  <div class="page">
    <div class="dashboard-grid">
      <AppCard class="hero-card">
        <div class="hero-content">
          <div>
            <h1>Today, powered by focus.</h1>
            <p>Keep your streak alive and ship your top priorities.</p>
            <div class="hero-stats">
              <div>
                <strong>{{ points }}</strong>
                <span>Points</span>
              </div>
              <div>
                <strong>{{ streak }}</strong>
                <span>Day Streak</span>
              </div>
            </div>
          </div>
          <FocusTimer />
        </div>
      </AppCard>

      <AppCard>
        <div class="card-header">
          <h3>Top 3 Priorities</h3>
          <AppButton compact variant="ghost" @click="openTaskModal">Add Task</AppButton>
        </div>
        <div v-if="topTasks.length">
          <div v-for="task in topTasks" :key="task.id" class="task-row">
            <div>
              <h4>{{ task.title }}</h4>
              <p>{{ task.description || 'No description yet.' }}</p>
            </div>
            <AppButton compact variant="ghost" @click="markDone(task)">Done</AppButton>
          </div>
        </div>
        <EmptyState v-else title="No priority tasks yet" subtitle="Queue your next wins." />
      </AppCard>

      <AppCard>
        <div class="card-header">
          <h3>Progress Pulse</h3>
          <span class="glow-pill">AI Glow</span>
        </div>
        <div class="progress-grid">
          <div>
            <strong>{{ completedToday }}</strong>
            <span>Completed Today</span>
          </div>
          <div>
            <strong>{{ dueSoon }}</strong>
            <span>Due in 48h</span>
          </div>
          <div>
            <strong>{{ focusSessions }}</strong>
            <span>Focus Sessions</span>
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>

<script lang="ts">
import AppButton from '../components/AppButton.vue';
import AppCard from '../components/AppCard.vue';
import EmptyState from '../components/EmptyState.vue';
import FocusTimer from '../components/FocusTimer.vue';
import { useUiStore } from '../stores/ui';
import { useTasksStore } from '../stores/tasks';
import { useLogsStore } from '../stores/logs';
import { useStatsStore } from '../stores/stats';
import dayjs from 'dayjs';
import type { Task } from '@shared/types';

export default {
  name: 'Dashboard',
  components: { AppButton, AppCard, EmptyState, FocusTimer },
  computed: {
    topTasks() {
      return useTasksStore().topTasks;
    },
    points() {
      return useStatsStore().points;
    },
    streak() {
      return useStatsStore().streak;
    },
    completedToday() {
      const today = dayjs().format('YYYY-MM-DD');
      return useLogsStore().logs.filter((log) => log.type === 'task' && log.date === today).length;
    },
    focusSessions() {
      const today = dayjs().format('YYYY-MM-DD');
      return useLogsStore().logs.filter((log) => log.type === 'focus' && log.date === today).length;
    },
    dueSoon() {
      const now = dayjs();
      return useTasksStore().tasks.filter((task) => {
        if (!task.dueDate || task.status === 'Done') return false;
        const due = dayjs(task.dueDate);
        return due.isAfter(now) && due.diff(now, 'hour') <= 48;
      }).length;
    }
  },
  methods: {
    openTaskModal() {
      useUiStore().openTaskModal();
    },
    markDone(task: Task) {
      useTasksStore().markDone(task);
    }
  }
};
</script>
