<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>Work Log</h2>
        <p>Auto-captured daily wins and focus sessions.</p>
      </div>
    </div>

    <AppCard>
      <div v-if="logs.length" class="log-list">
        <div v-for="log in logs" :key="log.id" class="log-row">
          <div>
            <h4>{{ log.titleSnapshot }}</h4>
            <p>{{ log.outcome }}</p>
            <small>{{ log.date }} - {{ log.type }}</small>
          </div>
          <span>{{ log.timeSpentMinutes }} min</span>
        </div>
      </div>
      <EmptyState v-else title="No logs yet" subtitle="Complete tasks or finish a focus session." />
    </AppCard>
  </div>
</template>

<script lang="ts">
import AppCard from '../components/AppCard.vue';
import EmptyState from '../components/EmptyState.vue';
import { useLogsStore } from '../stores/logs';

export default {
  name: 'WorkLog',
  components: { AppCard, EmptyState },
  computed: {
    logs() {
      return useLogsStore().logs;
    }
  }
};
</script>
