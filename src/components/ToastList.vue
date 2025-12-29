<template>
  <div class="toast-stack">
    <div v-for="toast in toasts" :key="toast.id" :class="['toast', `toast-${toast.type}`]">
      {{ toast.message }}
    </div>
  </div>
</template>

<script lang="ts">
import { useToastStore } from '../stores/toast';

export default {
  name: 'ToastList',
  computed: {
    toasts() {
      const store = useToastStore();
      return store.toasts;
    }
  }
};
</script>
