<template>
  <div class="focus-timer">
    <div class="timer-display">{{ displayTime }}</div>
    <div class="timer-actions">
      <AppButton compact @click="toggle">
        {{ isRunning ? 'Pause' : 'Start' }}
      </AppButton>
      <AppButton compact variant="ghost" @click="reset">Reset</AppButton>
    </div>
  </div>
</template>

<script lang="ts">
import AppButton from './AppButton.vue';
import { useFocusStore } from '../stores/focus';

export default {
  name: 'FocusTimer',
  components: { AppButton },
  computed: {
    isRunning() {
      return useFocusStore().isRunning;
    },
    displayTime() {
      return useFocusStore().displayTime;
    }
  },
  methods: {
    toggle() {
      const store = useFocusStore();
      if (store.isRunning) {
        store.pause();
      } else {
        store.start();
      }
    },
    reset() {
      useFocusStore().reset();
    }
  }
};
</script>
